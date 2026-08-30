import { expect, test } from "vitest";
import { assertFactualDataUnchanged } from "../../src/domain/components/component-data-integrity.js";
import type { ComponentNode } from "../../src/domain/components/component.js";

function chart(props: Record<string, unknown>): ComponentNode {
  return { kind: "trend-chart", order: 0, props } as ComponentNode;
}

const table = (props: Record<string, unknown>): ComponentNode =>
  ({ kind: "table", order: 0, props }) as ComponentNode;

/**
 * A chart's numbers are the company's record of what happened, not a caption.
 * The agent replaces the whole tree on every update, so nothing but this stops
 * "change the 42 to 50" from rewriting the organisation's own data.
 */
test("rejects a changed inline value", () => {
  const current = [
    table({ dataKey: "containers-by-state", rows: [{ name: "customs", value: 42 }] }),
  ];
  const next = [table({ dataKey: "containers-by-state", rows: [{ name: "customs", value: 50 }] })];

  expect(() => assertFactualDataUnchanged(current, next)).toThrow(/rows/);
});

test("rejects a repointed dataKey", () => {
  expect(() =>
    assertFactualDataUnchanged(
      [chart({ dataKey: "containers-by-state" })],
      [chart({ dataKey: "schedule-changes" })],
    ),
  ).toThrow(/dataKey/);
});

test("rejects rewritten timeline events", () => {
  const current = [
    { kind: "timeline", order: 0, props: { events: [{ text: "Salida", at: "2026-08-02" }] } },
  ] as ComponentNode[];
  const next = [
    { kind: "timeline", order: 0, props: { events: [{ text: "Salida", at: "2026-09-15" }] } },
  ] as ComponentNode[];

  expect(() => assertFactualDataUnchanged(current, next)).toThrow(/events/);
});

test("allows a cosmetic change on a node that carries data", () => {
  const current = [
    chart({ dataKey: "containers-by-state", title: "Contenedores", color: "brand" }),
  ];
  const next = [
    chart({ dataKey: "containers-by-state", title: "Estado de la carga", color: "accent" }),
  ];

  expect(() => assertFactualDataUnchanged(current, next)).not.toThrow();
});

/**
 * Choosing which column to show reads the same record differently; it does not
 * restate it. That is a presentation decision the user is entitled to make.
 */
test("allows repointing the projection", () => {
  const current = [table({ dataKey: "containers", columns: [{ key: "etd" }] })];
  const next = [table({ dataKey: "containers", columns: [{ key: "eta" }] })];

  expect(() => assertFactualDataUnchanged(current, next)).not.toThrow();
});

test("allows dropping a node that carried data", () => {
  const current = [chart({ dataKey: "containers-by-state" }), table({ rows: [{ a: 1 }] })];
  const next = [chart({ dataKey: "containers-by-state" })];

  expect(() => assertFactualDataUnchanged(current, next)).not.toThrow();
});

test("ignores key order when comparing", () => {
  const current = [table({ rows: [{ name: "customs", value: 42 }] })];
  const next = [table({ rows: [{ value: 42, name: "customs" }] })];

  expect(() => assertFactualDataUnchanged(current, next)).not.toThrow();
});

test("looks inside nested children", () => {
  const current = [
    { kind: "layout", order: 0, props: {}, children: [chart({ dataKey: "containers" })] },
  ] as ComponentNode[];
  const next = [
    { kind: "layout", order: 0, props: {}, children: [chart({ dataKey: "schedule-changes" })] },
  ] as ComponentNode[];

  expect(() => assertFactualDataUnchanged(current, next)).toThrow(/dataKey/);
});
