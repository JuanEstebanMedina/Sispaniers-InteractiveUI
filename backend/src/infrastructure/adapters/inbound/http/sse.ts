import type { OutgoingHttpHeaders } from "node:http";
import type { FastifyReply } from "fastify";

const STREAM_HEADERS: OutgoingHttpHeaders = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
};

const STREAM_HEADER_NAMES = new Set(Object.keys(STREAM_HEADERS).map((name) => name.toLowerCase()));

/**
 * Writing the head through `reply.raw` skips Fastify entirely, so every header
 * a plugin staged on the reply is dropped — including the Access-Control-*
 * headers from @fastify/cors. The browser then blocks the whole stream once the
 * frontend is served from a different origin than the API. Merge them back in.
 */
export function writeSseHead(reply: FastifyReply): void {
  const staged: OutgoingHttpHeaders = {};
  for (const [name, value] of Object.entries(reply.getHeaders())) {
    if (value === undefined || STREAM_HEADER_NAMES.has(name.toLowerCase())) continue;
    staged[name] = value;
  }

  reply.raw.writeHead(200, { ...staged, ...STREAM_HEADERS });
}
