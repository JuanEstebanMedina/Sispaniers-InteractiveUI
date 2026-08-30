import type { Component, ComponentNode } from "../../../domain/components/component.js";
import type { ComponentEventPublisher } from "../../../domain/ports/component-event-publisher.port.js";
import type { ComponentRepository } from "../../../domain/ports/component.repository.js";

export interface MarkEmailSentInput {
  componentId: string;
  to: string;
  subject: string;
  body: string;
  sentAt: Date;
}

export interface MarkEmailSentDeps {
  componentRepository: ComponentRepository;
  eventPublisher: ComponentEventPublisher;
}

function isUnsentEmail(node: ComponentNode): boolean {
  return node.kind === "email-action" && typeof node.props.sentAt !== "string";
}

/**
 * Rewrites the first still-unsent draft with the wording that actually left,
 * which is not always what the node held: the user may edit any field before
 * clicking send. Returns null when nothing matched, so the caller can tell an
 * unmarked send from a marked one.
 */
function markFirstUnsent(
  nodes: ComponentNode[],
  input: MarkEmailSentInput,
): ComponentNode[] | null {
  for (const [index, node] of nodes.entries()) {
    if (isUnsentEmail(node)) {
      const marked: ComponentNode = {
        ...node,
        props: {
          ...node.props,
          to: input.to,
          subject: input.subject,
          body: input.body,
          sentAt: input.sentAt.toISOString(),
        },
      };
      return nodes.with(index, marked);
    }
    if ("children" in node && Array.isArray(node.children)) {
      const markedChildren = markFirstUnsent(node.children, input);
      if (markedChildren !== null) {
        return nodes.with(index, { ...node, children: markedChildren });
      }
    }
  }
  return null;
}

export function createMarkEmailSentUseCase(deps: MarkEmailSentDeps) {
  const { componentRepository, eventPublisher } = deps;

  return async function markEmailSent(input: MarkEmailSentInput): Promise<Component | null> {
    const component = await componentRepository.findById(input.componentId);
    if (component === null) return null;

    const children = markFirstUnsent(component.children, input);
    if (children === null) return null;

    const updated: Component = { ...component, children };
    await componentRepository.save(updated);
    eventPublisher.publish(updated.operationId, "component-updated", updated);

    return updated;
  };
}
