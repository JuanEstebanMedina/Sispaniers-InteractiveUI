import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { createCreateComponentCommand } from "../../application/commands/create-component.command.js";
import { createIngestCompanyConceptsCommand } from "../../application/commands/ingest-company-concepts.command.js";
import { createQueryCompanyConceptsCommand } from "../../application/commands/query-company-concepts.command.js";
import { createSaveCompanyContextCommand } from "../../application/commands/save-company-context.command.js";
import { createUpdateComponentCommand } from "../../application/commands/update-component.command.js";
import { createCreateUserUseCase } from "../../application/use-cases/auth/create-user.use-case.js";
import { createGetMeUseCase } from "../../application/use-cases/auth/get-me.use-case.js";
import { createListUsersUseCase } from "../../application/use-cases/auth/list-users.use-case.js";
import { createLoginUseCase } from "../../application/use-cases/auth/login.use-case.js";
import { createRefreshTokenUseCase } from "../../application/use-cases/auth/refresh-token.use-case.js";
import { createUpdateUserUseCase } from "../../application/use-cases/auth/update-user.use-case.js";
import { createApplyTrackingEventUseCase } from "../../application/use-cases/dashboard/apply-tracking-event.use-case.js";
import { createCreateCompanyUseCase } from "../../application/use-cases/dashboard/create-company.use-case.js";
import { createCreateComponentUseCase } from "../../application/use-cases/dashboard/create-component.use-case.js";
import { createCreateOperationUseCase } from "../../application/use-cases/dashboard/create-operation.use-case.js";
import { createDeleteComponentUseCase } from "../../application/use-cases/dashboard/delete-component.use-case.js";
import { createEnrollOperationInSimulationUseCase } from "../../application/use-cases/dashboard/enroll-operation-in-simulation.use-case.js";
import { createGenerateComponentFromAiUseCase } from "../../application/use-cases/dashboard/generate-component-from-ai.use-case.js";
import { createGetDocumentPreviewUrlUseCase } from "../../application/use-cases/dashboard/get-document-preview-url.use-case.js";
import { createGetOperationComponentsUseCase } from "../../application/use-cases/dashboard/get-operation-components.use-case.js";
import { createGetOperationUseCase } from "../../application/use-cases/dashboard/get-operation.use-case.js";
import { createIngestCompanyConceptsUseCase } from "../../application/use-cases/dashboard/ingest-company-concepts.use-case.js";
import { createListCompaniesUseCase } from "../../application/use-cases/dashboard/list-companies.use-case.js";
import { createListOperationDocumentsUseCase } from "../../application/use-cases/dashboard/list-operation-documents.use-case.js";
import { createListOperationsUseCase } from "../../application/use-cases/dashboard/list-operations.use-case.js";
import { createQueryCompanyConceptsUseCase } from "../../application/use-cases/dashboard/query-company-concepts.use-case.js";
import { createRunSimulationTickUseCase } from "../../application/use-cases/dashboard/run-simulation-tick.use-case.js";
import { createSaveCompanyContextUseCase } from "../../application/use-cases/dashboard/save-company-context.use-case.js";
import { createUpdateCompanyUseCase } from "../../application/use-cases/dashboard/update-company.use-case.js";
import { createUpdateComponentContentUseCase } from "../../application/use-cases/dashboard/update-component-content.use-case.js";
import { createUpdateComponentPlacementUseCase } from "../../application/use-cases/dashboard/update-component-placement.use-case.js";
import { createUploadOperationDocumentUseCase } from "../../application/use-cases/dashboard/upload-operation-document.use-case.js";
import { createReceiveEmailUseCase } from "../../application/use-cases/email/receive-email.use-case.js";
import { createSendEmailUseCase } from "../../application/use-cases/email/send-email.use-case.js";
import { createUpsertOperationFromEmailUseCase } from "../../application/use-cases/email/upsert-operation-from-email.use-case.js";
import { createResolveCompanyUseCase } from "../../application/use-cases/shared/resolve-company.use-case.js";
import { CommandRegistry } from "../../domain/commands/command-registry.js";
import type { AiCompletionPort } from "../../domain/ports/ai-completion-port.js";
import type { AttachmentExtractor } from "../../domain/ports/attachment-extractor.port.js";
import type { AttachmentStorage } from "../../domain/ports/attachment-storage.port.js";
import type { AuthTokenPort } from "../../domain/ports/auth-token.port.js";
import type { CompanyConceptRepository } from "../../domain/ports/company-concept.repository.js";
import type { CompanyRepository } from "../../domain/ports/company.repository.js";
import type { ComponentRepository } from "../../domain/ports/component.repository.js";
import type { EmailSender } from "../../domain/ports/email-sender.port.js";
import type { OperationEventPublisher } from "../../domain/ports/operation-event-publisher.port.js";
import type { OperationRepository } from "../../domain/ports/operation.repository.js";
import type { PasswordHasher } from "../../domain/ports/password-hasher.port.js";
import type { SimulationRegistry } from "../../domain/ports/simulation-registry.port.js";
import type { UserRepository } from "../../domain/ports/user.repository.js";
import { buildApp } from "../adapters/inbound/http/app.js";
import { MultiFormatAttachmentExtractor } from "../adapters/outbound/attachment/multi-format-attachment-extractor.js";
import { BcryptPasswordHasher } from "../adapters/outbound/auth/bcrypt-password-hasher.js";
import { JwtTokenAdapter } from "../adapters/outbound/auth/jwt-token-adapter.js";
import { NodemailerEmailSender } from "../adapters/outbound/email/nodemailer-email-sender.js";
import { InMemoryComponentEventPublisher } from "../adapters/outbound/events/in-memory-component-event-publisher.js";
import { InMemoryOperationEventPublisher } from "../adapters/outbound/events/in-memory-operation-event-publisher.js";
import { FallbackAiCompletionAdapter } from "../adapters/outbound/fallback-ai-completion-adapter.js";
import { GeminiCompletionAdapter } from "../adapters/outbound/gemini-completion-adapter.js";
import { CryptoIdGenerator } from "../adapters/outbound/id/crypto-id-generator.js";
import { InMemoryChatHistoryStore } from "../adapters/outbound/memory/in-memory-chat-history-store.js";
import { MongoCompanyConceptRepository } from "../adapters/outbound/mongo/company-concept.repository.js";
import { MongoCompanyRepository } from "../adapters/outbound/mongo/company.repository.js";
import { MongoComponentRepository } from "../adapters/outbound/mongo/component.repository.js";
import { MongoOperationRepository } from "../adapters/outbound/mongo/operation.repository.js";
import { MongoUserRepository } from "../adapters/outbound/mongo/user.repository.js";
import { OpenAiCompletionAdapter } from "../adapters/outbound/openai-completion-adapter.js";
import { InMemorySimulationRegistry } from "../adapters/outbound/simulation/in-memory-simulation-registry.js";
import { SupabaseAttachmentStorage } from "../adapters/outbound/storage/supabase-attachment-storage.js";
import { connectMongo } from "./mongo.js";

const DEFAULT_SIMULATION_TICK_INTERVAL_MS = 20_000;

// ponytail: .md files stay under src/ only — dist/ is pure compiled JS.
// The Dockerfile's runtime stage copies src/application/{prompts,skills}
// directly (unrelated to tsc), and pnpm dev/start both run from backend/
// locally, so process.cwd() + "src/..." resolves in every environment.
const ARI_SYSTEM_PROMPT = readFileSync(
  join(process.cwd(), "src/application/prompts/ari-system-prompt.md"),
  "utf-8",
);
const CREATE_COMPONENT_SKILL = readFileSync(
  join(process.cwd(), "src/application/skills/create-component.skill.md"),
  "utf-8",
);
const UPDATE_COMPONENT_SKILL = readFileSync(
  join(process.cwd(), "src/application/skills/update-component.skill.md"),
  "utf-8",
);
const QUERY_COMPANY_CONCEPTS_SKILL = readFileSync(
  join(process.cwd(), "src/application/skills/query-company-concepts.skill.md"),
  "utf-8",
);
const INGEST_COMPANY_CONCEPTS_SKILL = readFileSync(
  join(process.cwd(), "src/application/skills/ingest-company-concepts.skill.md"),
  "utf-8",
);
const SAVE_COMPANY_CONTEXT_SKILL = readFileSync(
  join(process.cwd(), "src/application/skills/save-company-context.skill.md"),
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
  companyConceptRepository?: CompanyConceptRepository;
  componentRepository?: ComponentRepository;
  userRepository?: UserRepository;
  simulationRegistry?: SimulationRegistry;
  operationEventPublisher?: OperationEventPublisher;
  passwordHasher?: PasswordHasher;
  authTokenPort?: AuthTokenPort;
  aiCompletionPort?: AiCompletionPort;
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
  companyConceptRepository: CompanyConceptRepository;
  componentRepository: ComponentRepository;
  userRepository: UserRepository;
  close?: () => Promise<void>;
}

async function buildRepositories(overrides: CreateAppOverrides): Promise<RepositorySources> {
  const {
    operationRepository,
    companyRepository,
    companyConceptRepository,
    componentRepository,
    userRepository,
  } = overrides;

  if (
    operationRepository !== undefined &&
    companyRepository !== undefined &&
    componentRepository !== undefined &&
    userRepository !== undefined
  ) {
    return {
      operationRepository,
      companyRepository,
      companyConceptRepository: companyConceptRepository ?? {
        findForCompany: async () => [],
        findDefinitions: async () => [],
        saveDefinitions: async () => {},
        saveObservations: async () => {},
      },
      componentRepository,
      userRepository,
    };
  }

  const mongo = await connectMongo();

  return {
    operationRepository: operationRepository ?? new MongoOperationRepository(mongo.db),
    companyRepository: companyRepository ?? new MongoCompanyRepository(mongo.db),
    companyConceptRepository:
      companyConceptRepository ?? new MongoCompanyConceptRepository(mongo.db),
    componentRepository: componentRepository ?? new MongoComponentRepository(mongo.db),
    userRepository: userRepository ?? new MongoUserRepository(mongo.db),
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
    companyConceptRepository,
    componentRepository,
    userRepository,
    close,
  } = await buildRepositories(overrides);

  const passwordHasher: PasswordHasher = overrides.passwordHasher ?? new BcryptPasswordHasher();
  const authTokenPort: AuthTokenPort =
    overrides.authTokenPort ?? new JwtTokenAdapter(process.env.JWT_SECRET ?? "");

  const login = createLoginUseCase({ userRepository, passwordHasher, authTokenPort });
  const refreshToken = createRefreshTokenUseCase({ userRepository, authTokenPort });
  const getMe = createGetMeUseCase({ userRepository });
  const createUser = createCreateUserUseCase({ userRepository, passwordHasher, idGenerator });
  const listUsers = createListUsersUseCase({ userRepository });
  const updateUser = createUpdateUserUseCase({ userRepository, passwordHasher });

  const receiveEmail = createReceiveEmailUseCase({
    idGenerator,
    attachmentExtractor,
    attachmentStorage,
  });
  const sendEmail = createSendEmailUseCase({ emailSender, idGenerator, companyRepository });
  const createCompany = createCreateCompanyUseCase({ companyRepository, idGenerator });
  const listCompanies = createListCompaniesUseCase({ companyRepository });
  const updateCompany = createUpdateCompanyUseCase({ companyRepository });
  const resolveCompany = createResolveCompanyUseCase({ companyRepository, createCompany });
  const componentEventPublisher = new InMemoryComponentEventPublisher();
  const operationEventPublisher =
    overrides.operationEventPublisher ?? new InMemoryOperationEventPublisher();
  const upsertOperationFromEmail = createUpsertOperationFromEmailUseCase({
    operationRepository,
    componentRepository,
    resolveCompany,
    idGenerator,
    operationEventPublisher,
  });
  const createOperation = createCreateOperationUseCase({
    operationRepository,
    componentRepository,
    resolveCompany,
    idGenerator,
    operationEventPublisher,
  });
  const simulationRegistry = overrides.simulationRegistry ?? new InMemorySimulationRegistry();
  const createComponent = createCreateComponentUseCase({
    operationRepository,
    componentRepository,
    idGenerator,
    eventPublisher: componentEventPublisher,
  });
  const getOperation = createGetOperationUseCase({ operationRepository });
  const listOperationDocuments = createListOperationDocumentsUseCase({ operationRepository });
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
  });
  const queryCompanyConcepts = createQueryCompanyConceptsUseCase({
    operationRepository,
    companyConceptRepository,
  });
  const ingestCompanyConcepts = createIngestCompanyConceptsUseCase({
    operationRepository,
    companyConceptRepository,
  });
  const updateComponentPlacement = createUpdateComponentPlacementUseCase({
    operationRepository,
    componentRepository,
    eventPublisher: componentEventPublisher,
  });
  const updateComponentContent = createUpdateComponentContentUseCase({
    operationRepository,
    componentRepository,
    eventPublisher: componentEventPublisher,
  });
  const deleteComponent = createDeleteComponentUseCase({
    operationRepository,
    componentRepository,
  });
  const saveCompanyContext = createSaveCompanyContextUseCase({
    operationRepository,
    companyRepository,
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
  const aiCompletionPort: AiCompletionPort =
    overrides.aiCompletionPort ?? new FallbackAiCompletionAdapter(openAiAdapter, geminiAdapter);
  const commandRegistry = new CommandRegistry();
  const chatHistoryPort = new InMemoryChatHistoryStore();
  commandRegistry.register(
    createCreateComponentCommand({ createComponent, skill: CREATE_COMPONENT_SKILL }),
  );
  commandRegistry.register(
    createIngestCompanyConceptsCommand({
      ingestCompanyConcepts,
      skill: INGEST_COMPANY_CONCEPTS_SKILL,
    }),
  );
  commandRegistry.register(
    createQueryCompanyConceptsCommand({
      queryCompanyConcepts,
      skill: QUERY_COMPANY_CONCEPTS_SKILL,
    }),
  );
  commandRegistry.register(
    createSaveCompanyContextCommand({
      saveCompanyContext,
      skill: SAVE_COMPANY_CONTEXT_SKILL,
    }),
  );
  commandRegistry.register(
    createUpdateComponentCommand({
      updateComponentContent,
      updateComponentPlacement,
      skill: UPDATE_COMPONENT_SKILL,
    }),
  );
  const skills = commandRegistry
    .list()
    .map((command) => command.skill)
    .filter((skill): skill is string => skill !== undefined)
    .join("\n\n---\n\n");
  const generateComponentFromAi = createGenerateComponentFromAiUseCase({
    operationRepository,
    componentRepository,
    companyRepository,
    aiCompletionPort,
    commandRegistry,
    promptTemplate: `${ARI_SYSTEM_PROMPT}\n\n---\n\n${skills}`,
    chatHistoryPort,
    eventPublisher: componentEventPublisher,
    idGenerator,
  });
  const app = buildApp({
    receiveEmail,
    sendEmail,
    createCompany,
    listCompanies,
    updateCompany,
    upsertOperationFromEmail,
    createOperation,
    getOperation,
    listOperations,
    listOperationDocuments,
    getDocumentPreviewUrl,
    uploadOperationDocument,
    applyTrackingEvent,
    enrollOperationInSimulation,
    getOperationComponents,
    updateComponentPlacement,
    updateComponentContent,
    generateComponentFromAi,
    createComponent,
    deleteComponent,
    queryCompanyConcepts,
    componentEventPublisher,
    operationEventPublisher,
    login,
    refreshToken,
    getMe,
    createUser,
    listUsers,
    updateUser,
    authTokenPort,
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
