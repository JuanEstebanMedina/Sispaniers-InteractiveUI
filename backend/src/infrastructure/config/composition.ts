import type { FastifyInstance } from "fastify";
import { createCreateComponentUseCase } from "../../application/use-cases/dashboard/create-component.use-case.js";
import { createCreateOperationUseCase } from "../../application/use-cases/dashboard/create-operation.use-case.js";
import { createGetOperationComponentsUseCase } from "../../application/use-cases/dashboard/get-operation-components.use-case.js";
import { createGetOperationUseCase } from "../../application/use-cases/dashboard/get-operation.use-case.js";
import { createListOperationsUseCase } from "../../application/use-cases/dashboard/list-operations.use-case.js";
import { createUpdateComponentContentUseCase } from "../../application/use-cases/dashboard/update-component-content.use-case.js";
import { createUpdateOperationLayoutUseCase } from "../../application/use-cases/dashboard/update-operation-layout.use-case.js";
import { createReceiveEmailUseCase } from "../../application/use-cases/email/receive-email.use-case.js";
import { createSendEmailUseCase } from "../../application/use-cases/email/send-email.use-case.js";
import type { AttachmentExtractor } from "../../domain/ports/attachment-extractor.port.js";
import type { CompanyRepository } from "../../domain/ports/company.repository.js";
import type { ComponentRepository } from "../../domain/ports/component.repository.js";
import type { EmailSender } from "../../domain/ports/email-sender.port.js";
import type { OperationLayoutRepository } from "../../domain/ports/operation-layout.repository.js";
import type { OperationRepository } from "../../domain/ports/operation.repository.js";
import { buildApp } from "../adapters/inbound/http/app.js";
import { MultiFormatAttachmentExtractor } from "../adapters/outbound/attachment/multi-format-attachment-extractor.js";
import { NodemailerEmailSender } from "../adapters/outbound/email/nodemailer-email-sender.js";
import { InMemoryComponentEventPublisher } from "../adapters/outbound/events/in-memory-component-event-publisher.js";
import { CryptoIdGenerator } from "../adapters/outbound/id/crypto-id-generator.js";
import { MongoCompanyRepository } from "../adapters/outbound/mongo/company.repository.js";
import { MongoComponentRepository } from "../adapters/outbound/mongo/component.repository.js";
import { MongoOperationLayoutRepository } from "../adapters/outbound/mongo/operation-layout.repository.js";
import { MongoOperationRepository } from "../adapters/outbound/mongo/operation.repository.js";
import { connectMongo } from "./mongo.js";

// TODO: recibir/enviar correo todavía no persiste nada — solo se registra vía
// logs (request.log.warn en las routes). Cuando se retome el guardado, agregar
// RunRepository/EmailRepository en domain/ports/ y wirearlos únicamente aquí.

export interface CreateAppOverrides {
  emailSender?: EmailSender;
  attachmentExtractor?: AttachmentExtractor;
  operationRepository?: OperationRepository;
  companyRepository?: CompanyRepository;
  componentRepository?: ComponentRepository;
  operationLayoutRepository?: OperationLayoutRepository;
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
  const {
    operationRepository,
    companyRepository,
    componentRepository,
    operationLayoutRepository,
    close,
  } = await buildRepositories(overrides);

  const receiveEmail = createReceiveEmailUseCase({ idGenerator, attachmentExtractor });
  const sendEmail = createSendEmailUseCase({ emailSender, idGenerator });
  const createOperation = createCreateOperationUseCase({
    operationRepository,
    companyRepository,
    idGenerator,
  });
  const componentEventPublisher = new InMemoryComponentEventPublisher();
  const createComponent = createCreateComponentUseCase({
    componentRepository,
    idGenerator,
    eventPublisher: componentEventPublisher,
  });
  const getOperation = createGetOperationUseCase({ operationRepository });
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

  const app = buildApp({
    receiveEmail,
    sendEmail,
    createOperation,
    getOperation,
    listOperations,
    getOperationComponents,
    updateOperationLayout,
    updateComponentContent,
    createComponent,
    componentEventPublisher,
  });

  app.decorate("createComponent", createComponent);

  if (close !== undefined) {
    app.addHook("onClose", () => close());
  }

  return app;
}
