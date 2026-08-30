import type { Collection, Db } from "mongodb";
import type {
  CompanyConcept,
  CompanyConceptObservation,
  CompanyConceptResult,
} from "../../../../domain/logistics/company-concept.js";
import type { CompanyConceptRepository } from "../../../../domain/ports/company-concept.repository.js";

type CompanyConceptDocument = CompanyConcept & { _id: string };
type CompanyConceptObservationDocument = Omit<CompanyConceptObservation, "id" | "observedAt"> & {
  _id: string;
  observedAt: Date;
};

const CACHE_TTL_MS = 60_000;
const MAX_VALUES_PER_CONCEPT = 100;

export class MongoCompanyConceptRepository implements CompanyConceptRepository {
  private readonly concepts: Collection<CompanyConceptDocument>;
  private readonly values: Collection<CompanyConceptObservationDocument>;
  private readonly conceptCache = new Map<
    string,
    { expiresAt: number; concepts: CompanyConceptDocument[] }
  >();
  private readonly indexesReady: Promise<void>;

  constructor(db: Db) {
    this.concepts = db.collection<CompanyConceptDocument>("company_concepts");
    this.values = db.collection<CompanyConceptObservationDocument>("company_concept_values");
    this.indexesReady = Promise.all([
      this.concepts.createIndex({ companyId: 1, id: 1 }, { unique: true }),
      this.values.createIndex({ companyId: 1, conceptId: 1, observedAt: -1 }),
    ]).then(() => undefined);
  }

  async findForCompany(companyId: string, conceptIds: string[]): Promise<CompanyConceptResult[]> {
    await this.indexesReady;
    const requestedIds = [...new Set(conceptIds)];
    const concepts = await this.findConcepts(companyId);
    const requested =
      requestedIds.length === 0
        ? concepts
        : concepts.filter((concept) => requestedIds.includes(concept.id));
    if (requested.length === 0) {
      return [];
    }

    const observations = await this.values
      .find({ companyId, conceptId: { $in: requested.map((concept) => concept.id) } })
      .sort({ conceptId: 1, observedAt: -1 })
      .limit(requested.length * MAX_VALUES_PER_CONCEPT)
      .toArray();
    const valuesByConcept = new Map<
      string,
      Array<Record<string, unknown> & { observedAt: string }>
    >();

    for (const observation of observations) {
      const values = valuesByConcept.get(observation.conceptId) ?? [];
      if (values.length < MAX_VALUES_PER_CONCEPT) {
        values.push({ ...observation.value, observedAt: observation.observedAt.toISOString() });
      }
      valuesByConcept.set(observation.conceptId, values);
    }

    return requested.map((concept) => ({
      id: concept.id,
      name: concept.name,
      values: valuesByConcept.get(concept.id) ?? [],
    }));
  }

  async findDefinitions(companyId: string, conceptIds: string[]): Promise<CompanyConcept[]> {
    const concepts = await this.findConcepts(companyId);
    const requested = new Set(conceptIds);
    return concepts
      .filter((concept) => requested.has(concept.id))
      .map(({ _id: _ignored, ...concept }) => concept);
  }

  async saveDefinitions(concepts: CompanyConcept[]): Promise<void> {
    if (concepts.length === 0) {
      return;
    }

    await this.indexesReady;
    await this.concepts.bulkWrite(
      concepts.map((concept) => ({
        updateOne: {
          filter: { companyId: concept.companyId, id: concept.id },
          update: {
            $set: { name: concept.name },
            $setOnInsert: { ...concept, _id: `${concept.companyId}:${concept.id}` },
          },
          upsert: true,
        },
      })),
    );
    for (const companyId of new Set(concepts.map((concept) => concept.companyId))) {
      this.conceptCache.delete(companyId);
    }
  }

  async saveObservations(observations: CompanyConceptObservation[]): Promise<void> {
    if (observations.length === 0) {
      return;
    }

    await this.indexesReady;
    await this.values.bulkWrite(
      observations.map(({ id, ...observation }) => ({
        replaceOne: {
          filter: { _id: `${observation.companyId}:${id}` },
          replacement: { _id: `${observation.companyId}:${id}`, ...observation },
          upsert: true,
        },
      })),
    );
  }

  private async findConcepts(companyId: string): Promise<CompanyConceptDocument[]> {
    const cached = this.conceptCache.get(companyId);
    if (cached !== undefined && cached.expiresAt > Date.now()) {
      return cached.concepts;
    }

    const concepts = await this.concepts.find({ companyId }).toArray();
    this.conceptCache.set(companyId, { concepts, expiresAt: Date.now() + CACHE_TTL_MS });
    return concepts;
  }
}
