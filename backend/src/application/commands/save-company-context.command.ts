import type { Command, CommandContext } from "../../domain/commands/command.js";
import type { JsonSchema } from "../../domain/commands/json-schema.js";
import type { SaveCompanyContextInput } from "../use-cases/dashboard/save-company-context.use-case.js";

export interface SaveCompanyContextCommandDeps {
  saveCompanyContext: (input: SaveCompanyContextInput) => Promise<string>;
  skill?: string;
}

interface SaveCompanyContextCommandInput {
  context: string;
  reply: string;
}

const inputSchema: JsonSchema = {
  type: "object",
  properties: {
    context: { type: "string" },
    reply: { type: "string" },
  },
  required: ["context", "reply"],
};

export function createSaveCompanyContextCommand(deps: SaveCompanyContextCommandDeps): Command {
  const { saveCompanyContext, skill } = deps;

  return {
    name: "save_company_context",
    description: "Save a durable company fact or policy for Ari to use in future operations.",
    inputSchema,
    ...(skill === undefined ? {} : { skill }),

    async execute(rawInput: unknown, context: CommandContext): Promise<{ reply: string }> {
      const input = rawInput as SaveCompanyContextCommandInput;
      if (input.context.trim() === "") {
        throw new Error("Company context cannot be empty");
      }
      await saveCompanyContext({ operationId: context.operationId, context: input.context });
      return { reply: input.reply };
    },
  };
}
