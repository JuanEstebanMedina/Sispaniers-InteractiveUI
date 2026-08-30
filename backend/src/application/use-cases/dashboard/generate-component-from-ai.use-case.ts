import type { Component } from "../../../domain/components/component.js";
import { WIDGET_SIZES, type WidgetSizeName } from "../../../domain/components/widget-size.js";
import { WIDGET_KINDS, type WidgetKind } from "../../../domain/enums/widget-kind.js";
import { InvalidAiComponentError, OperationNotFoundError } from "../../../domain/model/errors.js";
import type { AiCompletionPort } from "../../../domain/ports/ai-completion-port.js";
import type { ComponentEventsBroadcaster } from "../../../domain/ports/component-events.port.js";
import type { OperationRepository } from "../../../domain/ports/operation.repository.js";
import type { CreateComponentInput } from "./create-component.use-case.js";

export type AiTrigger = "chat" | "auto";

export interface GenerateComponentFromAiInput {
  operationId: string;
  trigger: AiTrigger;
  input: string;
}

export interface GenerateComponentFromAiDeps {
  operationRepository: OperationRepository;
  aiCompletionPort: AiCompletionPort;
  createComponent: (input: CreateComponentInput) => Promise<Component>;
  componentEventsBroadcaster: ComponentEventsBroadcaster;
  promptTemplate: string;
}

const GRID_COLUMNS = 4;

const COMPONENT_CATALOG_WHEN_TO_USE: Record<WidgetKind, string> = {
  map: "Cuando hay que ubicar geográficamente un contenedor o buque en tránsito.",
  metric: "Cuando hay que comunicar un número o indicador clave de la operación.",
  "decision-panel": "Cuando la situación requiere una decisión humana entre varias opciones.",
  timeline: "Cuando hay que mostrar la secuencia de eventos/hitos de una operación.",
};

function buildComponentCatalog(): Array<{ type: WidgetKind; whenToUse: string }> {
  return WIDGET_KINDS.map((kind) => ({
    type: kind,
    whenToUse: COMPONENT_CATALOG_WHEN_TO_USE[kind],
  }));
}

function buildPrompt(template: string, trigger: AiTrigger, currentInput: string): string {
  const NOT_AVAILABLE = "N/A (no disponible en esta versión)";

  return template
    .replaceAll("{{company_knowledge}}", NOT_AVAILABLE)
    .replaceAll("{{client_memory}}", NOT_AVAILABLE)
    .replaceAll("{{run_history}}", NOT_AVAILABLE)
    .replaceAll("{{component_catalog}}", JSON.stringify(buildComponentCatalog()))
    .replaceAll("{{trigger}}", trigger)
    .replaceAll("{{current_input}}", currentInput)
    .replaceAll("{{grid_columns}}", String(GRID_COLUMNS));
}

function stripMarkdownCodeFence(text: string): string {
  const match = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return match ? (match[1] ?? "") : text.trim();
}

function truncateForDebugging(text: string): string {
  const MAX_LENGTH = 200;
  return text.length > MAX_LENGTH ? `${text.slice(0, MAX_LENGTH)}...` : text;
}

interface ParsedAiComponent {
  kind: WidgetKind;
  content: Record<string, unknown>;
  size: WidgetSizeName;
}

function isWidgetKind(value: unknown): value is WidgetKind {
  return typeof value === "string" && (WIDGET_KINDS as readonly string[]).includes(value);
}

function nearestSize(cols: number, rows: number): WidgetSizeName {
  let bestName: WidgetSizeName = "small";
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const [name, dimensions] of Object.entries(WIDGET_SIZES) as Array<
    [WidgetSizeName, { w: number; h: number }]
  >) {
    const distance = (dimensions.w - cols) ** 2 + (dimensions.h - rows) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestName = name;
    }
  }

  return bestName;
}

function parseAiResponse(rawText: string): ParsedAiComponent {
  const cleaned = stripMarkdownCodeFence(rawText);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new InvalidAiComponentError(`could not parse JSON: ${truncateForDebugging(rawText)}`);
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new InvalidAiComponentError(`expected an object: ${truncateForDebugging(rawText)}`);
  }

  const { type, props, layout } = parsed as Record<string, unknown>;

  if (!isWidgetKind(type)) {
    throw new InvalidAiComponentError(`unknown component type: ${truncateForDebugging(rawText)}`);
  }

  if (typeof layout !== "object" || layout === null) {
    throw new InvalidAiComponentError(`missing layout: ${truncateForDebugging(rawText)}`);
  }

  const { cols, rows } = layout as Record<string, unknown>;
  if (typeof cols !== "number" || typeof rows !== "number") {
    throw new InvalidAiComponentError(
      `missing layout.cols/layout.rows: ${truncateForDebugging(rawText)}`,
    );
  }

  return {
    kind: type,
    content: typeof props === "object" && props !== null ? (props as Record<string, unknown>) : {},
    size: nearestSize(cols, rows),
  };
}

export function createGenerateComponentFromAiUseCase(deps: GenerateComponentFromAiDeps) {
  const {
    operationRepository,
    aiCompletionPort,
    createComponent,
    componentEventsBroadcaster,
    promptTemplate,
  } = deps;

  return async function generateComponentFromAi(
    input: GenerateComponentFromAiInput,
  ): Promise<Component> {
    const operation = await operationRepository.findById(input.operationId);
    if (operation === null) {
      throw new OperationNotFoundError(input.operationId);
    }

    const prompt = buildPrompt(promptTemplate, input.trigger, input.input);
    const response = await aiCompletionPort.complete({ prompt });
    const parsed = parseAiResponse(response.text);

    const component = await createComponent({
      operationId: input.operationId,
      kind: parsed.kind,
      content: parsed.content,
      size: parsed.size,
    });

    componentEventsBroadcaster.publish(input.operationId, {
      type: "component-created",
      operationId: input.operationId,
      component,
    });

    return component;
  };
}
