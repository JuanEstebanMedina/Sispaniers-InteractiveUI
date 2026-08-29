import type { FastifyInstance } from "fastify";
import { buildApp } from "../adapters/inbound/http/app.js";

export function createApp(): FastifyInstance {
  return buildApp();
}
