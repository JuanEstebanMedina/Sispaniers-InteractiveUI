import { InvalidCommandInputError, UnknownCommandError } from "../model/errors.js";
import type { Command, CommandContext } from "./command.js";
import { validateJsonSchema } from "./json-schema.js";

export class CommandRegistry {
  private readonly commands = new Map<string, Command>();

  register(command: Command): void {
    if (this.commands.has(command.name)) {
      throw new Error(`Command already registered: ${command.name}`);
    }
    this.commands.set(command.name, command);
  }

  get(name: string): Command | undefined {
    return this.commands.get(name);
  }

  list(): Command[] {
    return [...this.commands.values()];
  }

  async dispatch(name: string, input: unknown, context: CommandContext): Promise<unknown> {
    const command = this.get(name);
    if (command === undefined) {
      throw new UnknownCommandError(name);
    }

    const validationError = validateJsonSchema(command.inputSchema, input);
    if (validationError !== null) {
      throw new InvalidCommandInputError(`${name}: ${validationError}`);
    }

    return command.execute(input, context);
  }
}
