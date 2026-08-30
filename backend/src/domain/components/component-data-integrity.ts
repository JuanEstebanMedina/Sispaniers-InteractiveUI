import { InvalidComponentTreeError } from "../model/errors.js";
import type { ComponentNode } from "./component.js";

/**
 * Props that state a fact the organisation owns: where the numbers come from
 * (`dataKey`) or the numbers themselves. Everything else on a node — titles,
 * colours, statuses, and the `columns`/`series`/`xKey`/`valueKey` that pick
 * which field to show — presents that record without restating it.
 */
const FACTUAL_PROPS = ["dataKey", "rows", "items", "events", "value", "max"] as const;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value !== "object" || value === null) return value;

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return entries.map(([key, nested]) => [key, canonicalize(nested)]);
}

function collectFactualClaims(
  nodes: ComponentNode[],
  into: Map<string, string>,
): Map<string, string> {
  for (const node of nodes) {
    for (const prop of FACTUAL_PROPS) {
      const claimed = (node.props as Record<string, unknown>)[prop];
      if (claimed === undefined) continue;
      into.set(`${prop}:${JSON.stringify(canonicalize(claimed))}`, prop);
    }
    if ("children" in node && Array.isArray(node.children)) {
      collectFactualClaims(node.children, into);
    }
  }
  return into;
}

/**
 * An update replaces the component's whole tree, so a model asked to "change
 * the 42 to 50" can silently rewrite the company's own record while looking
 * like an edit. Every factual claim in the new tree must already exist in the
 * current one: restyling and dropping nodes stay allowed, inventing values
 * does not.
 */
export function assertFactualDataUnchanged(current: ComponentNode[], next: ComponentNode[]): void {
  const known = collectFactualClaims(current, new Map());

  for (const [claim, prop] of collectFactualClaims(next, new Map())) {
    if (!known.has(claim)) {
      throw new InvalidComponentTreeError(
        `${prop} carries data owned by the company and cannot be changed by an update; send it back exactly as it was, or drop the node entirely`,
      );
    }
  }
}

const ALREADY_SENT =
  "this email was already sent and cannot be edited — somebody has it already; send it back " +
  "exactly as it was, or drop the node and propose a new email instead";

interface EmailClaim {
  sentAt: string;
  wording: string;
}

function collectEmails(nodes: ComponentNode[], into: EmailClaim[]): EmailClaim[] {
  for (const node of nodes) {
    if (node.kind === "email-action") {
      const props = node.props as Record<string, unknown>;
      into.push({
        sentAt: typeof props.sentAt === "string" ? props.sentAt : "",
        wording: JSON.stringify(["to", "subject", "body"].map((prop) => canonicalize(props[prop]))),
      });
    }
    if ("children" in node && Array.isArray(node.children)) {
      collectEmails(node.children, into);
    }
  }
  return into;
}

/**
 * A sent email is the one thing in a component nobody can take back: somebody
 * already has it, and the node is the only proof it went out.
 *
 * It has to survive the update untouched. Letting it be dropped would defeat
 * the rule outright, because rewriting a message and deleting it to write
 * another are the same two trees — a fresh draft recalls nothing of the old
 * one. A genuinely new email is a new component, which this never sees.
 */
export function assertSentEmailsUnchanged(current: ComponentNode[], next: ComponentNode[]): void {
  const byMark = new Map(
    collectEmails(current, [])
      .filter((email) => email.sentAt !== "")
      .map((email) => [email.sentAt, email.wording]),
  );
  const survivors = new Map(
    collectEmails(next, [])
      .filter((email) => email.sentAt !== "")
      .map((email) => [email.sentAt, email.wording]),
  );

  for (const [sentAt, wording] of byMark) {
    if (survivors.get(sentAt) !== wording) {
      throw new InvalidComponentTreeError(ALREADY_SENT);
    }
  }

  for (const sentAt of survivors.keys()) {
    if (!byMark.has(sentAt)) {
      throw new InvalidComponentTreeError(
        "an email-action carries a sentAt that was never sent from here; drop it, because only sending the email sets that mark",
      );
    }
  }
}
