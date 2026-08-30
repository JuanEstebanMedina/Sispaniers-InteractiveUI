import { expect, test } from "vitest";
import { assertSentEmailsUnchanged } from "../../src/domain/components/component-data-integrity.js";
import type { ComponentNode } from "../../src/domain/components/component.js";

const SENT_AT = "2026-08-30T12:00:00.000Z";

function email(props: Record<string, unknown>): ComponentNode {
  return { kind: "email-action", order: 0, props } as ComponentNode;
}

const sent = email({
  to: "compras@florestropicales.co",
  subject: "Booking de septiembre",
  body: "Hola, ¿alguna novedad?",
  sentAt: SENT_AT,
});

/**
 * A sent email left the building. The agent replaces the whole tree on every
 * update, so nothing but this stops "hazlo menos formal" from rewriting words
 * somebody already received.
 */
test("rejects rewriting the subject of an email that was already sent", () => {
  const next = [email({ ...sent.props, subject: "Booking de septiembre — ¿novedades?" })];

  expect(() => assertSentEmailsUnchanged([sent], next)).toThrow(/already sent/i);
});

test("rejects rewriting the body of an email that was already sent", () => {
  const next = [email({ ...sent.props, body: "Hola, ¡contame!" })];

  expect(() => assertSentEmailsUnchanged([sent], next)).toThrow(/already sent/i);
});

test("rejects dropping the sentAt mark so the email looks unsent again", () => {
  const { sentAt: _dropped, ...draft } = sent.props as Record<string, unknown>;

  expect(() => assertSentEmailsUnchanged([sent], [email(draft)])).toThrow(/already sent/i);
});

test("rejects claiming an email was sent when it never was", () => {
  const draft = email({ to: "ops@carrier.co", subject: "Booking", body: "Hi" });
  const next = [email({ ...draft.props, sentAt: SENT_AT })];

  expect(() => assertSentEmailsUnchanged([draft], next)).toThrow(/never sent/i);
});

test("allows restyling around a sent email as long as the email itself is intact", () => {
  const current: ComponentNode[] = [
    { kind: "title", order: 0, props: { text: "Ask for booking" } } as ComponentNode,
    sent,
  ];
  const next: ComponentNode[] = [
    { kind: "title", order: 0, props: { text: "Booking request" } } as ComponentNode,
    email({ ...sent.props }),
  ];

  expect(() => assertSentEmailsUnchanged(current, next)).not.toThrow();
});

/**
 * Dropping the node and writing a fresh one is a rewrite wearing a disguise:
 * the wording differs, so nothing about the new node recalls the old, and the
 * proof that a message went out disappears with it. A genuinely new email is a
 * new component, which this rule never sees.
 */
test("rejects dropping a sent email to make room for a rewritten one", () => {
  const next = [email({ to: "compras@florestropicales.co", subject: "Nuevo", body: "Hola" })];

  expect(() => assertSentEmailsUnchanged([sent], next)).toThrow(/already sent/i);
});

test("allows adding a second draft alongside the sent one", () => {
  const next = [sent, email({ to: "ops@carrier.co", subject: "Otro", body: "Hola" })];

  expect(() => assertSentEmailsUnchanged([sent], next)).not.toThrow();
});

test("looks inside nested children", () => {
  const wrap = (child: ComponentNode): ComponentNode =>
    ({ kind: "layout", order: 0, props: {}, children: [child] }) as ComponentNode;
  const next = [wrap(email({ ...sent.props, subject: "otro" }))];

  expect(() => assertSentEmailsUnchanged([wrap(sent)], next)).toThrow(/already sent/i);
});
