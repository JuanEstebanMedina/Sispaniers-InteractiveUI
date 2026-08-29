import { afterEach, beforeEach, expect, test } from "vitest";
import { resolveMongoUri } from "../../src/infrastructure/config/mongo.js";

const MONGO_VARS = ["MONGODB_URI", "MONGO_USER", "MONGO_PASSWORD", "MONGO_DB", "MONGO_PORT"];

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(MONGO_VARS.map((key) => [key, process.env[key]]));
  for (const key of MONGO_VARS) {
    delete process.env[key];
  }
});

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

test("an explicit MONGODB_URI wins over everything else", () => {
  process.env.MONGODB_URI = "mongodb://elsewhere:1234/other";
  process.env.MONGO_USER = "ignored";
  process.env.MONGO_PASSWORD = "ignored";

  expect(resolveMongoUri()).toBe("mongodb://elsewhere:1234/other");
});

test("credentials from the compose env assemble an authenticated local uri", () => {
  process.env.MONGO_USER = "sispaniers";
  process.env.MONGO_PASSWORD = "localdev";
  process.env.MONGO_DB = "sispaniers";
  process.env.MONGO_PORT = "27017";

  expect(resolveMongoUri()).toBe(
    "mongodb://sispaniers:localdev@localhost:27017/sispaniers?authSource=admin",
  );
});

test("a password with uri-hostile characters is escaped", () => {
  process.env.MONGO_USER = "a@b";
  process.env.MONGO_PASSWORD = "p@ss:w/rd";

  expect(resolveMongoUri()).toContain("mongodb://a%40b:p%40ss%3Aw%2Frd@localhost:27017/");
});

test("without credentials it falls back to an unauthenticated local mongo", () => {
  expect(resolveMongoUri()).toBe("mongodb://localhost:27017/sispaniers");
});
