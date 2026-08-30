import { beforeEach, expect, test, vi } from "vitest";
import { createUpdateComponentContentUseCase } from "../../src/application/use-cases/dashboard/update-component-content.use-case.js";
import type { Component, ComponentNode } from "../../src/domain/components/component.js";

let stored: Component;

const deps = {
  operationRepository: { findById: vi.fn(async () => ({ id: "op-1" })) },
  componentRepository: {
    findById: vi.fn(async () => stored),
    save: vi.fn(async () => undefined),
    setField: vi.fn(async () => undefined),
  },
  eventPublisher: { publish: vi.fn() },
};

function useCase() {
  return createUpdateComponentContentUseCase(deps as never);
}

function component(children: ComponentNode[]): Component {
  return { id: "cmp-1", operationId: "op-1", size: "tall", children } as Component;
}

beforeEach(() => vi.clearAllMocks());

/**
 * A path-scoped edit writes one field, but the field it writes can be the
 * company's own record — the narrower shape is not a narrower permission.
 */
test("rejects a path edit that rewrites a frozen figure", async () => {
  stored = component([
    { kind: "stat", order: 0, props: { label: "Containers", value: 42 } } as ComponentNode,
  ]);

  await expect(
    useCase()({
      operationId: "op-1",
      componentId: "cmp-1",
      path: "children.0.props.value",
      value: 50,
    }),
  ).rejects.toThrow(/owned by the company/i);
});

test("rejects a path edit that rewrites an email somebody already received", async () => {
  stored = component([
    {
      kind: "email-action",
      order: 0,
      props: { to: "a@b.co", subject: "Booking", body: "Hi", sentAt: "2026-08-30T12:00:00.000Z" },
    } as ComponentNode,
  ]);

  await expect(
    useCase()({
      operationId: "op-1",
      componentId: "cmp-1",
      path: "children.0.props.subject",
      value: "Booking — urgent",
    }),
  ).rejects.toThrow(/already sent/i);
});

test("allows a path edit that only restyles", async () => {
  stored = component([
    { kind: "stat", order: 0, props: { label: "Containers", value: 42 } } as ComponentNode,
  ]);

  await expect(
    useCase()({
      operationId: "op-1",
      componentId: "cmp-1",
      path: "children.0.props.label",
      value: "Containers on board",
    }),
  ).resolves.toBeTruthy();
});
