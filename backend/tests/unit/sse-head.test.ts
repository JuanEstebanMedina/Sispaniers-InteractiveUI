import type { FastifyReply } from "fastify";
import { describe, expect, it } from "vitest";
import { writeSseHead } from "../../src/infrastructure/adapters/inbound/http/sse.js";

function fakeReply(headers: Record<string, unknown>) {
  const written: { status?: number; headers?: Record<string, unknown> } = {};
  const reply = {
    getHeaders: () => headers,
    raw: {
      writeHead(status: number, sent: Record<string, unknown>) {
        written.status = status;
        written.headers = sent;
      },
    },
  } as unknown as FastifyReply;
  return { reply, written };
}

describe("writeSseHead", () => {
  it("keeps the headers Fastify plugins already set on the reply", () => {
    const { reply, written } = fakeReply({
      "access-control-allow-origin": "https://front.example",
      vary: "Origin",
    });

    writeSseHead(reply);

    expect(written.status).toBe(200);
    expect(written.headers).toMatchObject({
      "access-control-allow-origin": "https://front.example",
      vary: "Origin",
    });
  });

  it("declares the event stream", () => {
    const { reply, written } = fakeReply({});

    writeSseHead(reply);

    expect(written.headers).toMatchObject({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
  });

  it("asks proxies not to buffer the stream", () => {
    const { reply, written } = fakeReply({});

    writeSseHead(reply);

    expect(written.headers?.["X-Accel-Buffering"]).toBe("no");
  });

  it("lets the stream headers win over a conflicting reply header", () => {
    const { reply, written } = fakeReply({ "content-type": "application/json" });

    writeSseHead(reply);

    expect(written.headers?.["content-type"]).toBeUndefined();
    expect(written.headers?.["Content-Type"]).toBe("text/event-stream");
  });

  it("drops headers left undefined instead of sending them empty", () => {
    const { reply, written } = fakeReply({ "x-absent": undefined });

    writeSseHead(reply);

    expect(written.headers).not.toHaveProperty("x-absent");
  });
});
