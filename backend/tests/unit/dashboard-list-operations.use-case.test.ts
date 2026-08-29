import { expect, test } from "vitest";
import { createListOperationsUseCase } from "../../src/application/use-cases/dashboard/list-operations.use-case.js";
import type { Operation } from "../../src/domain/logistics/operation.js";
import { InvalidFilterCombinationError } from "../../src/domain/model/errors.js";
import { InMemoryOperationRepository } from "../../src/infrastructure/adapters/outbound/logistics/in-memory-operation-repository.js";
import { anOperation, withAllContainersDelivered } from "../support/operation-fixtures.js";

async function listOver(operations: Operation[]) {
  const operationRepository = new InMemoryOperationRepository();
  for (const operation of operations) {
    await operationRepository.save(operation);
  }
  return createListOperationsUseCase({ operationRepository });
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

test("search matches a fragment of the client id, ignoring case", async () => {
  const andes = anOperation({ clientId: "client-Andes-Textiles" });
  const cafe = anOperation({ clientId: "client-cafe-del-valle" });

  const listOperations = await listOver([andes, cafe]);

  expect(await listOperations({ search: "ANDES" })).toEqual([
    { operation: andes, status: "in_transit" },
  ]);
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
