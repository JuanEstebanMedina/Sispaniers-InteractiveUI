import { expect, test } from "vitest";
import { createListOperationsUseCase } from "../../src/application/use-cases/list-operations.use-case.js";
import { FakeOperationRepository } from "../support/fakes.js";
import { anOperation, withAllContainersDelivered } from "../support/operation-fixtures.js";

function useCaseOver(repository: FakeOperationRepository) {
  return createListOperationsUseCase({ operations: repository });
}

test("no operations yield an empty list", async () => {
  const listOperations = useCaseOver(new FakeOperationRepository());

  expect(await listOperations()).toEqual([]);
});

test("every operation carries the status derived from its containers", async () => {
  const repository = new FakeOperationRepository();
  const inTransit = anOperation();
  const delivered = withAllContainersDelivered(anOperation());
  await repository.save(inTransit);
  await repository.save(delivered);

  const listed = await useCaseOver(repository)();

  expect(listed.map((operation) => [operation.id, operation.status])).toEqual([
    [inTransit.id, "in_transit"],
    [delivered.id, "delivered"],
  ]);
});

test("every booking carries its own derived status alongside the operation status", async () => {
  const repository = new FakeOperationRepository();
  const operation = anOperation();
  const [booking] = operation.bookings;
  if (booking === undefined) {
    throw new Error("fixture must carry one booking");
  }
  await repository.save({
    ...operation,
    bookings: [
      booking,
      {
        ...booking,
        id: "second-booking",
        containers: [{ id: "c2", containerNumber: "MSKU7654321", state: "customs" }],
      },
    ],
  });

  const [listed] = await useCaseOver(repository)();

  expect(listed?.bookings.map((it) => it.status)).toEqual(["in_transit", "customs"]);
  expect(listed?.status).toBe("in_transit");
});

test("listed operations keep the whole aggregate, documents included", async () => {
  const repository = new FakeOperationRepository();
  const operation = anOperation();
  await repository.save(operation);

  const [listed] = await useCaseOver(repository)();

  expect(listed?.documents).toEqual(operation.documents);
  expect(listed?.clientId).toBe(operation.clientId);
  expect(listed?.createdAt).toEqual(operation.createdAt);
});
