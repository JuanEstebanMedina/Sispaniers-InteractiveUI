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
import type { GridComponentKind } from "../../../domain/enums/widget-kind.js";
import { OperationNotFoundError } from "../../../domain/model/errors.js";
import type { ComponentEventPublisher } from "../../../domain/ports/component-event-publisher.port.js";
import type { ComponentRepository } from "../../../domain/ports/component.repository.js";
import type { IdGenerator } from "../../../domain/ports/id-generator.port.js";
import type { OperationRepository } from "../../../domain/ports/operation.repository.js";

export interface CreateComponentInput {
  operationId: string;
  kind: GridComponentKind;
  children: ComponentNode[];
  size: WidgetSizeName;
}

export interface CreateComponentDeps {
  operationRepository: OperationRepository;
  componentRepository: ComponentRepository;
  idGenerator: IdGenerator;
  eventPublisher: ComponentEventPublisher;
}

export function createCreateComponentUseCase(deps: CreateComponentDeps) {
  const { operationRepository, componentRepository, idGenerator, eventPublisher } = deps;

  return async function createComponent(input: CreateComponentInput): Promise<Component> {
    validateComponentTree(input.children);
    validateComponentSize(input.size, input.children);

    // A component whose operation does not exist can never be read or deleted
    // again: both of those resolve the operation first.
    if ((await operationRepository.findById(input.operationId)) === null) {
      throw new OperationNotFoundError(input.operationId);
    }

    const siblings = await componentRepository.findByOperationId(input.operationId);

    const component: Component = {
      id: idGenerator.newId(),
      operationId: input.operationId,
      order: nextOrderAfter(siblings),
      size: input.size,
      kind: input.kind,
      children: input.children,
      createdAt: new Date(),
    };

    await componentRepository.save(component);
    eventPublisher.publish(component.operationId, "component-created", component);

    return component;
  };
}
