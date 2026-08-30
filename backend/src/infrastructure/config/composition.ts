import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { createApplyTrackingEventUseCase } from "../../application/use-cases/dashboard/apply-tracking-event.use-case.js";
import { createCreateComponentUseCase } from "../../application/use-cases/dashboard/create-component.use-case.js";
import { createCreateOperationUseCase } from "../../application/use-cases/dashboard/create-operation.use-case.js";
import { createEnrollOperationInSimulationUseCase } from "../../application/use-cases/dashboard/enroll-operation-in-simulation.use-case.js";
import { createGenerateComponentFromAiUseCase } from "../../application/use-cases/dashboard/generate-component-from-ai.use-case.js";
import { createGetDocumentPreviewUrlUseCase } from "../../application/use-cases/dashboard/get-document-preview-url.use-case.js";
import { createGetOperationComponentsUseCase } from "../../application/use-cases/dashboard/get-operation-components.use-case.js";
import { createGetOperationUseCase } from "../../application/use-cases/dashboard/get-operation.use-case.js";
import { createListOperationsUseCase } from "../../application/use-cases/dashboard/list-operations.use-case.js";
import { createRunSimulationTickUseCase } from "../../application/use-cases/dashboard/run-simulation-tick.use-case.js";
import { createUpdateComponentContentUseCase } from "../../application/use-cases/dashboard/update-component-content.use-case.js";
import { createUpdateOperationLayoutUseCase } from "../../application/use-cases/dashboard/update-operation-layout.use-case.js";
import { createUploadOperationDocumentUseCase } from "../../application/use-cases/dashboard/upload-operation-document.use-case.js";
import { createReceiveEmailUseCase } from "../../application/use-cases/email/receive-email.use-case.js";
import { createSendEmailUseCase } from "../../application/use-cases/email/send-email.use-case.js";
import { createUpsertOperationFromEmailUseCase } from "../../application/use-cases/email/upsert-operation-from-email.use-case.js";
import type { AiCompletionPort } from "../../domain/ports/ai-completion-port.js";
import type { AttachmentExtractor } from "../../domain/ports/attachment-extractor.port.js";
import type { AttachmentStorage } from "../../domain/ports/attachment-storage.port.js";
import type { CompanyRepository } from "../../domain/ports/company.repository.js";
import type { ComponentRepository } from "../../domain/ports/component.repository.js";
import type { EmailSender } from "../../domain/ports/email-sender.port.js";
import type { OperationEventPublisher } from "../../domain/ports/operation-event-publisher.port.js";
import type { OperationLayoutRepository } from "../../domain/ports/operation-layout.repository.js";
import type { OperationRepository } from "../../domain/ports/operation.repository.js";
import type { SimulationRegistry } from "../../domain/ports/simulation-registry.port.js";
import { buildApp } from "../adapters/inbound/http/app.js";
import { MultiFormatAttachmentExtractor } from "../adapters/outbound/attachment/multi-format-attachment-extractor.js";
import { NodemailerEmailSender } from "../adapters/outbound/email/nodemailer-email-sender.js";
import { InMemoryComponentEventPublisher } from "../adapters/outbound/events/in-memory-component-event-publisher.js";
import { InMemoryOperationEventPublisher } from "../adapters/outbound/events/in-memory-operation-event-publisher.js";
import { FallbackAiCompletionAdapter } from "../adapters/outbound/fallback-ai-completion-adapter.js";
import { GeminiCompletionAdapter } from "../adapters/outbound/gemini-completion-adapter.js";
import { CryptoIdGenerator } from "../adapters/outbound/id/crypto-id-generator.js";
import { MongoCompanyRepository } from "../adapters/outbound/mongo/company.repository.js";
import { MongoComponentRepository } from "../adapters/outbound/mongo/component.repository.js";
import { MongoOperationLayoutRepository } from "../adapters/outbound/mongo/operation-layout.repository.js";
import { MongoOperationRepository } from "../adapters/outbound/mongo/operation.repository.js";
import { OpenAiCompletionAdapter } from "../adapters/outbound/openai-completion-adapter.js";
import { InMemorySimulationRegistry } from "../adapters/outbound/simulation/in-memory-simulation-registry.js";
import { SupabaseAttachmentStorage } from "../adapters/outbound/storage/supabase-attachment-storage.js";
import { connectMongo } from "./mongo.js";

const DEFAULT_SIMULATION_TICK_INTERVAL_MS = 20_000;

// ponytail: tsc doesn't copy .md assets to dist, so this reads from `src/`
// relative to process.cwd() (both `pnpm dev` and `pnpm start` run from
// backend/). Add a build-time asset copy if that assumption ever breaks.
const ARI_SYSTEM_PROMPT = readFileSync(
  join(process.cwd(), "src/application/prompts/ari-system-prompt.md"),
  "utf-8",
);

// TODO: sending an email still doesn't persist anything — it's only logged
// (request.log.warn in the routes). Receiving an email now persists via
// upsertOperationFromEmail when the subject links to an operation; add an
// EmailRepository in domain/ports/ if a raw send-log is ever needed too.

export interface CreateAppOverrides {
  emailSender?: EmailSender;
  attachmentExtractor?: AttachmentExtractor;
  attachmentStorage?: AttachmentStorage;
  operationRepository?: OperationRepository;
  companyRepository?: CompanyRepository;
  componentRepository?: ComponentRepository;
  operationLayoutRepository?: OperationLayoutRepository;
  simulationRegistry?: SimulationRegistry;
  operationEventPublisher?: OperationEventPublisher;
}

function buildEmailSender(override: EmailSender | undefined): EmailSender {
  if (override !== undefined) {
    return override;
  }
  return new NodemailerEmailSender(
    process.env.GMAIL_USER ?? "",
    process.env.GMAIL_APP_PASSWORD ?? "",
  );
}

function buildAttachmentStorage(override: AttachmentStorage | undefined): AttachmentStorage {
  if (override !== undefined) {
    return override;
  }
  return new SupabaseAttachmentStorage(
    process.env.SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  );
}

interface RepositorySources {
  operationRepository: OperationRepository;
  companyRepository: CompanyRepository;
  componentRepository: ComponentRepository;
  operationLayoutRepository: OperationLayoutRepository;
  close?: () => Promise<void>;
}

async function buildRepositories(overrides: CreateAppOverrides): Promise<RepositorySources> {
  const { operationRepository, companyRepository, componentRepository, operationLayoutRepository } =
    overrides;

  if (
    operationRepository !== undefined &&
    companyRepository !== undefined &&
    componentRepository !== undefined &&
    operationLayoutRepository !== undefined
  ) {
    return {
      operationRepository,
      companyRepository,
      componentRepository,
      operationLayoutRepository,
    };
  }

  const mongo = await connectMongo();

  return {
    operationRepository: operationRepository ?? new MongoOperationRepository(mongo.db),
    companyRepository: companyRepository ?? new MongoCompanyRepository(mongo.db),
    componentRepository: componentRepository ?? new MongoComponentRepository(mongo.db),
    operationLayoutRepository:
      operationLayoutRepository ?? new MongoOperationLayoutRepository(mongo.db),
    close: mongo.close,
  };
}

export async function createApp(overrides: CreateAppOverrides = {}): Promise<FastifyInstance> {
  const idGenerator = new CryptoIdGenerator();
  const emailSender = buildEmailSender(overrides.emailSender);
  const attachmentExtractor = overrides.attachmentExtractor ?? new MultiFormatAttachmentExtractor();
  const attachmentStorage = buildAttachmentStorage(overrides.attachmentStorage);
  const {
    operationRepository,
    companyRepository,
    componentRepository,
    operationLayoutRepository,
    close,
  } = await buildRepositories(overrides);

  const receiveEmail = createReceiveEmailUseCase({
    idGenerator,
    attachmentExtractor,
    attachmentStorage,
  });
  const sendEmail = createSendEmailUseCase({ emailSender, idGenerator });
  const upsertOperationFromEmail = createUpsertOperationFromEmailUseCase({
    operationRepository,
    idGenerator,
  });
  const createOperation = createCreateOperationUseCase({
    operationRepository,
    companyRepository,
    idGenerator,
  });
  const componentEventPublisher = new InMemoryComponentEventPublisher();
  const operationEventPublisher =
    overrides.operationEventPublisher ?? new InMemoryOperationEventPublisher();
  const simulationRegistry = overrides.simulationRegistry ?? new InMemorySimulationRegistry();
  const createComponent = createCreateComponentUseCase({
    componentRepository,
    idGenerator,
    eventPublisher: componentEventPublisher,
  });
  const getOperation = createGetOperationUseCase({ operationRepository });
  const getDocumentPreviewUrl = createGetDocumentPreviewUrlUseCase({
    operationRepository,
    attachmentStorage,
  });
  const uploadOperationDocument = createUploadOperationDocumentUseCase({
    operationRepository,
    attachmentExtractor,
    attachmentStorage,
    idGenerator,
  });
  const applyTrackingEvent = createApplyTrackingEventUseCase({
    operationRepository,
    operationEventPublisher,
  });
  const enrollOperationInSimulation = createEnrollOperationInSimulationUseCase({
    operationRepository,
    operationEventPublisher,
    simulationRegistry,
    idGenerator,
  });
  const runSimulationTick = createRunSimulationTickUseCase({
    operationRepository,
    simulationRegistry,
    operationEventPublisher,
    applyTrackingEvent,
  });
  const listOperations = createListOperationsUseCase({ operationRepository, companyRepository });
  const getOperationComponents = createGetOperationComponentsUseCase({
    operationRepository,
    componentRepository,
    operationLayoutRepository,
  });
  const updateOperationLayout = createUpdateOperationLayoutUseCase({
    operationRepository,
    operationLayoutRepository,
  });
  const updateComponentContent = createUpdateComponentContentUseCase({
    operationRepository,
    componentRepository,
    eventPublisher: componentEventPublisher,
  });
  // ponytail: the OpenAI/Gemini SDKs throw at construction time on a falsy
  // apiKey, so an empty string would crash boot when the env var isn't set.
  // A placeholder keeps boot working; real calls fail with a normal auth
  // error until the corresponding *_API_KEY is configured.
  const openAiAdapter = new OpenAiCompletionAdapter(
    process.env.OPENAI_API_KEY ?? "missing-openai-api-key",
  );
  const geminiAdapter = new GeminiCompletionAdapter(
    process.env.GEMINI_API_KEY ?? "missing-gemini-api-key",
  );
  const aiCompletionPort: AiCompletionPort = new FallbackAiCompletionAdapter(
    openAiAdapter,
    geminiAdapter,
  );
  const generateComponentFromAi = createGenerateComponentFromAiUseCase({
    operationRepository,
    componentRepository,
    aiCompletionPort,
    createComponent,
    updateComponentContent,
    promptTemplate: ARI_SYSTEM_PROMPT,
  });

  const app = buildApp({
    receiveEmail,
    sendEmail,
    upsertOperationFromEmail,
    createOperation,
    getOperation,
    listOperations,
    getDocumentPreviewUrl,
    uploadOperationDocument,
    applyTrackingEvent,
    enrollOperationInSimulation,
    getOperationComponents,
    updateOperationLayout,
    updateComponentContent,
    generateComponentFromAi,
    createComponent,
    componentEventPublisher,
    operationEventPublisher,
  });

  app.decorate("createComponent", createComponent);

  // The simulator's ticker is disabled in tests — nothing in this codebase's
  // test suite wants a live timer running past the test's own lifetime.
  if (process.env.NODE_ENV !== "test") {
    const tickIntervalMs = Number(
      process.env.SIMULATION_TICK_INTERVAL_MS ?? DEFAULT_SIMULATION_TICK_INTERVAL_MS,
    );
    const timer = setInterval(() => {
      void runSimulationTick().catch((error: unknown) => {
        app.log.error(error, "simulation tick failed");
      });
    }, tickIntervalMs);
    app.addHook("onClose", () => {
      clearInterval(timer);
    });
  }

  if (close !== undefined) {
    app.addHook("onClose", () => close());
  }

  return app;
}
