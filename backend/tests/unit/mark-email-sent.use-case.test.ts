import { beforeEach, expect, test, vi } from "vitest";
import { createMarkEmailSentUseCase } from "../../src/application/use-cases/email/mark-email-sent.use-case.js";
import type { Component, ComponentNode } from "../../src/domain/components/component.js";

const SENT_AT = new Date("2026-08-30T12:00:00.000Z");

function email(props: Record<string, unknown>): ComponentNode {
  return { kind: "email-action", order: 1, props } as ComponentNode;
}

function component(children: ComponentNode[]): Component {
  return {
    id: "cmp-booking-email",
    operationId: "op-1",
    size: "tall",
    priority: "normal",
    children,
    createdAt: new Date("2026-08-25T00:00:00.000Z"),
  } as Component;
}

let stored: Component;
const componentRepository = {
  findById: vi.fn(async () => stored),
  save: vi.fn(async (next: Component) => {
    stored = next;
  }),
};
const eventPublisher = { publish: vi.fn() };

function useCase() {
  return createMarkEmailSentUseCase({
    componentRepository: componentRepository as never,
    eventPublisher: eventPublisher as never,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  stored = component([
    { kind: "title", order: 0, props: { text: "Ask for booking" } } as ComponentNode,
    email({ to: "compras@flores.co", subject: "Booking", body: "Hola" }),
  ]);
});

test("records what was actually sent, not what the draft happened to hold", async () => {
  await useCase()({
    componentId: "cmp-booking-email",
    to: "compras@flores.co",
    subject: "Booking — urgente",
    body: "Hola, urgente",
    sentAt: SENT_AT,
  });

  const marked = stored.children[1] as ComponentNode;
  expect(marked.props).toEqual({
    to: "compras@flores.co",
    subject: "Booking — urgente",
    body: "Hola, urgente",
    sentAt: SENT_AT.toISOString(),
  });
});

test("announces the change so open dashboards stop showing an unsent draft", async () => {
  await useCase()({
    componentId: "cmp-booking-email",
    to: "compras@flores.co",
    subject: "Booking",
    body: "Hola",
    sentAt: SENT_AT,
  });

  expect(eventPublisher.publish).toHaveBeenCalledWith("op-1", "component-updated", stored);
});

test("marks the draft that is still unsent when the component holds an earlier one", async () => {
  stored = component([
    email({ to: "a@b.co", subject: "First", body: "One", sentAt: "2026-08-29T00:00:00.000Z" }),
    email({ to: "c@d.co", subject: "Second", body: "Two" }),
  ]);

  await useCase()({
    componentId: "cmp-booking-email",
    to: "c@d.co",
    subject: "Second",
    body: "Two",
    sentAt: SENT_AT,
  });

  expect((stored.children[0] as ComponentNode).props.sentAt).toBe("2026-08-29T00:00:00.000Z");
  expect((stored.children[1] as ComponentNode).props.sentAt).toBe(SENT_AT.toISOString());
});

test("does nothing when the component holds no unsent email", async () => {
  stored = component([{ kind: "title", order: 0, props: { text: "No email" } } as ComponentNode]);

  await useCase()({
    componentId: "cmp-booking-email",
    to: "a@b.co",
    subject: "x",
    body: "y",
    sentAt: SENT_AT,
  });

  expect(componentRepository.save).not.toHaveBeenCalled();
  expect(eventPublisher.publish).not.toHaveBeenCalled();
});
