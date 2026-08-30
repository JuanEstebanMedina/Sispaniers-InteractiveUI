import { expect, test } from "vitest";
import { createQueryCompanyConceptsCommand } from "../../src/application/commands/query-company-concepts.command.js";
import { CommandRegistry } from "../../src/domain/commands/command-registry.js";
import { InvalidCommandInputError } from "../../src/domain/model/errors.js";

test("passes requested concepts with operation scope", async () => {
  const command = createQueryCompanyConceptsCommand({
    queryCompanyConcepts: async ({ operationId, conceptIds }) => {
      expect(operationId).toBe("op-1");
      expect(conceptIds).toEqual(["volume"]);
      return [{ id: "volume", name: "Volume", values: [] }];
    },
  });
  const registry = new CommandRegistry();
  registry.register(command);

  await expect(
    registry.dispatch(command.name, { conceptIds: ["volume"] }, { operationId: "op-1" }),
  ).resolves.toEqual({
    concepts: [{ id: "volume", name: "Volume", values: [] }],
  });
});

test("rejects unbounded concept requests", async () => {
  const command = createQueryCompanyConceptsCommand({ queryCompanyConcepts: async () => [] });

  await expect(
    command.execute(
      { conceptIds: Array.from({ length: 21 }, () => "volume") },
      { operationId: "op-1" },
    ),
  ).rejects.toBeInstanceOf(InvalidCommandInputError);
});
