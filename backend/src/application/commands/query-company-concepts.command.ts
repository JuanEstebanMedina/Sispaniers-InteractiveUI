import type { Command, CommandContext } from "../../domain/commands/command.js";
import type { JsonSchema } from "../../domain/commands/json-schema.js";
import type { CompanyConceptResult } from "../../domain/logistics/company-concept.js";
import { InvalidCommandInputError } from "../../domain/model/errors.js";
import type { QueryCompanyConceptsInput } from "../use-cases/dashboard/query-company-concepts.use-case.js";

export interface QueryCompanyConceptsCommandDeps {
  queryCompanyConcepts: (input: QueryCompanyConceptsInput) => Promise<CompanyConceptResult[]>;
  skill?: string;
}

export interface QueryCompanyConceptsCommandInput {
  conceptIds: string[];
}

export interface QueryCompanyConceptsCommandResult {
  concepts: CompanyConceptResult[];
}

const inputSchema: JsonSchema = {
  type: "object",
  properties: {
    conceptIds: { type: "array", items: { type: "string" } },
  },
  required: ["conceptIds"],
};

export function createQueryCompanyConceptsCommand(deps: QueryCompanyConceptsCommandDeps): Command {
  const { queryCompanyConcepts, skill } = deps;

  return {
    name: "query_company_concepts",
    description: "Read recent values for named concepts belonging to this operation's company.",
    inputSchema,
    ...(skill === undefined ? {} : { skill }),

    async execute(
      rawInput: unknown,
      context: CommandContext,
    ): Promise<QueryCompanyConceptsCommandResult> {
      const { conceptIds } = rawInput as QueryCompanyConceptsCommandInput;
      if (conceptIds.length > 20) {
        throw new InvalidCommandInputError("conceptIds cannot contain more than 20 concept ids");
      }

      return {
        concepts: await queryCompanyConcepts({ operationId: context.operationId, conceptIds }),
      };
    },
  };
}
