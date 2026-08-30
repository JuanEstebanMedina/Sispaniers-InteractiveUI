import { expect, test } from "vitest";
import { createListOperationsUseCase } from "../../src/application/use-cases/dashboard/list-operations.use-case.js";
import type { Company } from "../../src/domain/logistics/company.js";
import type { Operation } from "../../src/domain/logistics/operation.js";
import {
  CompanyNotFoundError,
  InvalidFilterCombinationError,
} from "../../src/domain/model/errors.js";
import { InMemoryCompanyRepository } from "../../src/infrastructure/adapters/outbound/logistics/in-memory-company-repository.js";
import { InMemoryOperationRepository } from "../../src/infrastructure/adapters/outbound/logistics/in-memory-operation-repository.js";
import {
  aCompany,
  anOperation,
  withAllContainersDelivered,
} from "../support/operation-fixtures.js";

async function listOver(operations: Operation[], companies: Company[] = []) {
  const operationRepository = new InMemoryOperationRepository();
  const companyRepository = new InMemoryCompanyRepository();
  for (const operation of operations) {
    await operationRepository.save(operation);
  }
  for (const company of companies) {
    await companyRepository.save(company);
  }
  return createListOperationsUseCase({ operationRepository, companyRepository });
}

test("without filters every operation comes back with its derived status", async () => {
  const inTransit = anOperation();
  const delivered = withAllContainersDelivered(anOperation());

  const listOperations = await listOver([inTransit, delivered]);

  expect(await listOperations({})).toEqual([
    { operation: inTransit, status: "in_transit" },
    { operation: delivered, status: "delivered" },
  ]);
});

test("the status filter keeps only the operations that derive to it", async () => {
  const inTransit = anOperation();
  const delivered = withAllContainersDelivered(anOperation());

  const listOperations = await listOver([inTransit, delivered]);

  expect(await listOperations({ status: "delivered" })).toEqual([
    { operation: delivered, status: "delivered" },
  ]);
});

test("companyId narrows the listing to the operations that company owns", async () => {
  const andes = anOperation({ companyId: "company-andes" });
  const cafe = anOperation({ companyId: "company-cafe" });
  const company = aCompany({ id: "company-andes" });

  const listOperations = await listOver([andes, cafe], [company]);

  expect(await listOperations({ companyId: "company-andes" })).toEqual([
    { operation: andes, status: "in_transit" },
  ]);
});

test("companyId also matches an operation where the company is a party on a booking", async () => {
  const base = anOperation();
  const asParty = anOperation({
    bookings: base.bookings.map((booking) => ({ ...booking, companyIds: ["company-andes"] })),
  });
  const unrelated = anOperation();

  const listOperations = await listOver([asParty, unrelated], [aCompany({ id: "company-andes" })]);

  expect(await listOperations({ companyId: "company-andes" })).toEqual([
    { operation: asParty, status: "in_transit" },
  ]);
});

test("a bookingless operation still lists under the company that owns it", async () => {
  const fresh = anOperation({ companyId: "company-andes", bookings: [] });

  const listOperations = await listOver([fresh], [aCompany({ id: "company-andes" })]);

  expect(await listOperations({ companyId: "company-andes" })).toHaveLength(1);
});

test("a company without operations lists nothing instead of everything", async () => {
  const listOperations = await listOver([anOperation()], [aCompany({ id: "company-empty" })]);

  expect(await listOperations({ companyId: "company-empty" })).toEqual([]);
});

test("an unknown company id is rejected", async () => {
  const listOperations = await listOver([anOperation()]);

  await expect(listOperations({ companyId: "ghost" })).rejects.toThrow(CompanyNotFoundError);
});

test("the health filter narrows to operations carrying that health", async () => {
  const healthy = anOperation({ health: "ok" });
  const failing = anOperation({ health: "error" });

  const listOperations = await listOver([healthy, failing]);

  expect(await listOperations({ health: "error" })).toEqual([
    { operation: failing, status: "in_transit" },
  ]);
});

test("date covers the whole day, so an operation created just before midnight still matches", async () => {
  const justBeforeMidnight = anOperation({ createdAt: new Date("2026-03-10T23:59:59.000Z") });
  const nextDay = anOperation({ createdAt: new Date("2026-03-11T00:00:01.000Z") });

  const listOperations = await listOver([justBeforeMidnight, nextDay]);

  const sameDay = await listOperations({ date: new Date("2026-03-10T00:00:00.000Z") });

  expect(sameDay).toEqual([{ operation: justBeforeMidnight, status: "in_transit" }]);
});

test("from and to bound the creation range inclusively", async () => {
  const before = anOperation({ createdAt: new Date("2026-03-01T00:00:00.000Z") });
  const inside = anOperation({ createdAt: new Date("2026-03-05T00:00:00.000Z") });
  const after = anOperation({ createdAt: new Date("2026-03-20T00:00:00.000Z") });

  const listOperations = await listOver([before, inside, after]);

  const ranged = await listOperations({
    from: new Date("2026-03-05T00:00:00.000Z"),
    to: new Date("2026-03-10T00:00:00.000Z"),
  });

  expect(ranged).toEqual([{ operation: inside, status: "in_transit" }]);
});

test("date cannot be combined with from", async () => {
  const listOperations = await listOver([]);

  await expect(
    listOperations({ date: new Date("2026-03-10T00:00:00.000Z"), from: new Date() }),
  ).rejects.toThrow(InvalidFilterCombinationError);
});

test("date cannot be combined with to", async () => {
  const listOperations = await listOver([]);

  await expect(
    listOperations({ date: new Date("2026-03-10T00:00:00.000Z"), to: new Date() }),
  ).rejects.toThrow(InvalidFilterCombinationError);
});

/* ---------------------------------------------------------------------------
 * Búsqueda libre y ordenamiento
 *
 * Los dos existen porque la web los necesita y hasta ahora los resolvía en el
 * navegador: con cientos de operaciones eso deja de servir, porque el cliente
 * sólo puede ordenar y buscar dentro de lo que ya descargó.
 * ------------------------------------------------------------------------ */

test("the search filter matches the operation id", async () => {
  const wanted = anOperation({ id: "op-andes-textiles-001" });
  const other = anOperation({ id: "op-cafe-del-valle-001" });

  const listOperations = await listOver([wanted, other]);
  const found = await listOperations({ search: "andes" });

  expect(found.map(({ operation }) => operation.id)).toEqual(["op-andes-textiles-001"]);
});

test("the search filter matches a company id", async () => {
  const withCompany = (id: string, companyId: string) => {
    const operation = anOperation({ id });
    return {
      ...operation,
      bookings: operation.bookings.map((booking) => ({ ...booking, companyIds: [companyId] })),
    };
  };
  const wanted = withCompany("op-1", "company-andes-textiles");
  const other = withCompany("op-2", "company-cafe-del-valle");

  const listOperations = await listOver([wanted, other]);
  const found = await listOperations({ search: "cafe" });

  expect(found.map(({ operation }) => operation.id)).toEqual(["op-2"]);
});

test("the search filter is case-insensitive", async () => {
  const operation = anOperation({ id: "op-andes-001" });

  const listOperations = await listOver([operation]);

  expect(await listOperations({ search: "ANDES" })).toHaveLength(1);
});

test("sorting by id ascending orders the results", async () => {
  const second = anOperation({ id: "op-b" });
  const first = anOperation({ id: "op-a" });

  const listOperations = await listOver([second, first]);
  const found = await listOperations({ sortBy: "id", sortDir: "asc" });

  expect(found.map(({ operation }) => operation.id)).toEqual(["op-a", "op-b"]);
});

test("sorting by id descending reverses it", async () => {
  const first = anOperation({ id: "op-a" });
  const second = anOperation({ id: "op-b" });

  const listOperations = await listOver([first, second]);
  const found = await listOperations({ sortBy: "id", sortDir: "desc" });

  expect(found.map(({ operation }) => operation.id)).toEqual(["op-b", "op-a"]);
});

test("sorting by updatedAt uses the newest schedule change, not the creation date", async () => {
  // La creada primero movió su ETA ayer; la creada después nunca se movió.
  // Ordenando por "lo último que pasó", la vieja va primero.
  const template = anOperation();
  const [templateBooking] = template.bookings;
  if (templateBooking === undefined) throw new Error("the fixture must have a booking");

  const moved = anOperation({
    id: "op-moved",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    bookings: [
      {
        ...templateBooking,
        schedule: {
          etdOriginal: new Date("2026-01-02T00:00:00Z"),
          etaOriginal: new Date("2026-02-01T00:00:00Z"),
          etaCurrent: new Date("2026-02-10T00:00:00Z"),
          changes: [
            {
              previousEta: new Date("2026-02-01T00:00:00Z"),
              newEta: new Date("2026-02-10T00:00:00Z"),
              reason: "port congestion",
              occurredAt: new Date("2026-06-01T00:00:00Z"),
            },
          ],
        },
      },
    ],
  });
  const untouched = anOperation({
    id: "op-untouched",
    createdAt: new Date("2026-03-01T00:00:00Z"),
    bookings: [],
  });

  const listOperations = await listOver([untouched, moved]);
  const found = await listOperations({ sortBy: "updatedAt", sortDir: "desc" });

  expect(found.map(({ operation }) => operation.id)).toEqual(["op-moved", "op-untouched"]);
});

test("without an explicit sort the newest activity comes first", async () => {
  // Sin orden por defecto, un body vacío devolvería el orden natural de Mongo
  // —que no está definido— y la lista se reordenaría sola entre refrescos.
  const older = anOperation({ id: "op-older", createdAt: new Date("2026-01-01T00:00:00Z") });
  const newer = anOperation({ id: "op-newer", createdAt: new Date("2026-05-01T00:00:00Z") });

  const listOperations = await listOver([older, newer]);
  const found = await listOperations({});

  expect(found.map(({ operation }) => operation.id)).toEqual(["op-newer", "op-older"]);
});

test("sorting by company uses the owning company, not only the booking parties", async () => {
  const owned = anOperation({ id: "op-owned", companyId: "company-andes", bookings: [] });
  const other = anOperation({ id: "op-other", companyId: "company-zeta", bookings: [] });

  const listOperations = await listOver([other, owned]);

  const sorted = await listOperations({ sortBy: "company", sortDir: "asc" });

  expect(sorted.map(({ operation }) => operation.id)).toEqual(["op-owned", "op-other"]);
});
