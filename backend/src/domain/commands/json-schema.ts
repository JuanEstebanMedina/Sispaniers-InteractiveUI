export interface JsonSchema {
  [key: string]: unknown;
  type: "object" | "array" | "string" | "number" | "boolean" | "null";
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: (string | number)[];
  nullable?: boolean;
}

function typeOfMatches(schema: JsonSchema, value: unknown): boolean {
  switch (schema.type) {
    case "object":
      return typeof value === "object" && value !== null && !Array.isArray(value);
    case "array":
      return Array.isArray(value);
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number";
    case "boolean":
      return typeof value === "boolean";
    case "null":
      return value === null;
  }
}

// ponytail: subset JSON Schema validator (type/required/properties/items/
// enum/nullable only) — sufficient for this change's one Command; swap to ajv
// if a future Command needs pattern/oneOf/$ref-level constraints.
export function validateJsonSchema(schema: JsonSchema, value: unknown): string | null {
  if (value === null) {
    return schema.nullable === true ? null : `expected ${schema.type}, got null`;
  }

  if (!typeOfMatches(schema, value)) {
    return `expected ${schema.type}, got ${typeof value}`;
  }

  if (schema.enum !== undefined) {
    if (!(schema.enum as unknown[]).includes(value as string | number)) {
      return `value ${JSON.stringify(value)} is not one of ${JSON.stringify(schema.enum)}`;
    }
  }

  if (schema.type === "object") {
    const record = value as Record<string, unknown>;

    for (const requiredKey of schema.required ?? []) {
      if (!(requiredKey in record)) {
        return `missing required property "${requiredKey}"`;
      }
    }

    if (schema.properties !== undefined) {
      for (const [key, propertySchema] of Object.entries(schema.properties)) {
        if (!(key in record)) {
          continue;
        }
        const error = validateJsonSchema(propertySchema, record[key]);
        if (error !== null) {
          return `property "${key}": ${error}`;
        }
      }
    }
  }

  if (schema.type === "array" && schema.items !== undefined) {
    const array = value as unknown[];
    for (let index = 0; index < array.length; index += 1) {
      const error = validateJsonSchema(schema.items, array[index]);
      if (error !== null) {
        return `item ${index}: ${error}`;
      }
    }
  }

  return null;
}
