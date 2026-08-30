import type { Command, CommandContext } from "../../domain/commands/command.js";
import type { JsonSchema } from "../../domain/commands/json-schema.js";
import { InvalidCommandInputError } from "../../domain/model/errors.js";
import type { IngestCompanyConceptsInput } from "../use-cases/dashboard/ingest-company-concepts.use-case.js";

export interface IngestCompanyConceptsCommandDeps {
  ingestCompanyConcepts: (input: IngestCompanyConceptsInput) => Promise<{
    definitions: number;
    observations: number;
  }>;
  skill?: string;
}

const inputSchema: JsonSchema = {
  type: "object",
  properties: {
    definitions: {
      type: "array",
      items: {
        type: "object",
        properties: { id: { type: "string" }, name: { type: "string" } },
        required: ["id", "name"],
      },
    },
    observations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          conceptId: { type: "string" },
          observedAt: { type: "string" },
          value: { type: "object" },
        },
        required: ["conceptId", "observedAt", "value"],
      },
    },
  },
  required: ["definitions", "observations"],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseInput(rawInput: unknown): Omit<IngestCompanyConceptsInput, "operationId"> {
  if (
    !isRecord(rawInput) ||
    !Array.isArray(rawInput.definitions) ||
    !Array.isArray(rawInput.observations)
  ) {
    throw new InvalidCommandInputError("definitions and observations must be arrays");
  }
  if (
    rawInput.definitions.some(
      (definition) =>
        !isRecord(definition) ||
        typeof definition.id !== "string" ||
        typeof definition.name !== "string",
    ) ||
    rawInput.observations.some(
      (observation) =>
        !isRecord(observation) ||
        typeof observation.conceptId !== "string" ||
        typeof observation.observedAt !== "string" ||
        !isRecord(observation.value),
    )
  ) {
    throw new InvalidCommandInputError(
      "concept definitions and observations have an invalid shape",
    );
  }
  return rawInput as Omit<IngestCompanyConceptsInput, "operationId">;
}

export function createIngestCompanyConceptsCommand(
  deps: IngestCompanyConceptsCommandDeps,
): Command {
  const { ingestCompanyConcepts, skill } = deps;

  return {
    name: "ingest_company_concepts",
    description: "Store explicit company metrics extracted from an inbound event.",
    inputSchema,
    ...(skill === undefined ? {} : { skill }),
    execute: (rawInput: unknown, context: CommandContext) =>
      ingestCompanyConcepts({
        operationId: context.operationId,
        ...parseInput(rawInput),
      }),
  };
}
