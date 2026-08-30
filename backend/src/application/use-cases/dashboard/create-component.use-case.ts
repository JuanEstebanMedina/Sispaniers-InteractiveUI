import {
  validateComponentSize,
  validateComponentTree,
} from "../../../domain/components/component-node.js";
import {
  type Component,
  type ComponentNode,
  nextOrderAfter,
} from "../../../domain/components/component.js";
import type { WidgetSizeName } from "../../../domain/components/widget-size.js";
import type { ComponentPriority } from "../../../domain/enums/widget-kind.js";
import type { GridComponentKind } from "../../../domain/enums/widget-kind.js";
import type { ComponentEventPublisher } from "../../../domain/ports/component-event-publisher.port.js";
import type { ComponentRepository } from "../../../domain/ports/component.repository.js";
import type { IdGenerator } from "../../../domain/ports/id-generator.port.js";

export interface CreateComponentInput {
  operationId: string;
  kind: GridComponentKind;
  children: ComponentNode[];
  size: WidgetSizeName;
  priority?: ComponentPriority;
}

export interface CreateComponentDeps {
  componentRepository: ComponentRepository;
  idGenerator: IdGenerator;
  eventPublisher: ComponentEventPublisher;
}

export function createCreateComponentUseCase(deps: CreateComponentDeps) {
  const { componentRepository, idGenerator, eventPublisher } = deps;

  return async function createComponent(input: CreateComponentInput): Promise<Component> {
    validateComponentTree(input.children);
    validateComponentSize(input.size, input.children);

    const siblings = await componentRepository.findByOperationId(input.operationId);

    const component: Component = {
      id: idGenerator.newId(),
      operationId: input.operationId,
      order: nextOrderAfter(siblings),
      size: input.size,
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      kind: input.kind,
      children: input.children,
      createdAt: new Date(),
    };

    await componentRepository.save(component);
    eventPublisher.publish(component.operationId, "component-created", component);

    return component;
  };
}
