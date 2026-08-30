import type { Company } from "../src/domain/logistics/company.js";
import type { Booking, Operation } from "../src/domain/logistics/operation.js";
import { MongoCompanyRepository } from "../src/infrastructure/adapters/outbound/mongo/company.repository.js";
import { MongoOperationRepository } from "../src/infrastructure/adapters/outbound/mongo/operation.repository.js";
import { connectMongo } from "../src/infrastructure/config/mongo.js";

function at(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

interface BookingSeed {
  id: string;
  companyIds: string[];
  carrier: string;
  vessel: string;
  originPort: string;
  destinationPort: string;
  etd: string;
  eta: string;
  delayedTo?: string;
  delayReason?: string;
  containers: Array<[containerNumber: string, state: Booking["containers"][number]["state"]]>;
}

function scheduleChanges(seed: BookingSeed): Booking["schedule"]["changes"] {
  const { delayedTo, delayReason } = seed;

  if (delayedTo === undefined || delayReason === undefined) {
    return [];
  }

  return [
    {
      previousEta: at(seed.eta),
      newEta: at(delayedTo),
      reason: delayReason,
      occurredAt: at(seed.etd),
    },
  ];
}

function buildBooking(seed: BookingSeed): Booking {
  return {
    id: seed.id,
    companyIds: seed.companyIds,
    carrier: seed.carrier,
    vessel: seed.vessel,
    originPort: seed.originPort,
    destinationPort: seed.destinationPort,
    schedule: {
      etdOriginal: at(seed.etd),
      etaOriginal: at(seed.eta),
      etaCurrent: at(seed.delayedTo ?? seed.eta),
      changes: scheduleChanges(seed),
    },
    containers: seed.containers.map(([containerNumber, state], index) => ({
      id: `${seed.id}-c${index + 1}`,
      containerNumber,
      state,
    })),
  };
}

const OPERATIONS: Operation[] = [
  {
    id: "op-andes-textiles-001",
    bookings: [
      buildBooking({
        id: "bkg-andes-001",
        companyIds: ["company-andes-textiles"],
        carrier: "Maersk",
        vessel: "Maersk Sentosa",
        originPort: "CNSHA",
        destinationPort: "COCTG",
        etd: "2026-07-02",
        eta: "2026-08-14",
        delayedTo: "2026-08-21",
        delayReason: "port congestion at origin",
        containers: [
          ["MSKU1029384", "in_transit"],
          ["MSKU1029385", "in_transit"],
        ],
      }),
    ],
    context: {
      emails: [
        {
          source: "gmail",
          messageId: "email-andes-014",
          from: "docs@maersk.com",
          to: "ops@andestextiles.co",
          subject: "Bill of Lading — booking bkg-andes-001",
          receivedAt: at("2026-07-04"),
          bodyText: "Please find the signed BL attached.",
        },
      ],
      documents: [
        {
          id: "doc-andes-bl-001",
          type: "BillOfLading",
          format: "pdf",
          bucketKey: "operations/op-andes-textiles-001/bl-001.pdf",
          bookingId: "bkg-andes-001",
          sourceEmailId: "email-andes-014",
          extractedData: { grossWeightKg: 21400, packages: 880 },
          receivedAt: at("2026-07-04"),
        },
        {
          id: "doc-andes-inv-001",
          type: "Invoice",
          format: "spreadsheet",
          bucketKey: "operations/op-andes-textiles-001/invoice-001.xlsx",
          bookingId: "bkg-andes-001",
          extractedData: { currency: "USD", total: 48250 },
          receivedAt: at("2026-07-05"),
        },
      ],
    },
    createdAt: at("2026-07-01"),
  },
  {
    id: "op-andes-textiles-002",
    bookings: [
      buildBooking({
        id: "bkg-andes-002",
        companyIds: ["company-andes-textiles"],
        carrier: "Hapag-Lloyd",
        vessel: "Bremen Express",
        originPort: "DEHAM",
        destinationPort: "COBAQ",
        etd: "2026-06-10",
        eta: "2026-07-08",
        containers: [["HLXU8811223", "delivered"]],
      }),
    ],
    context: {
      emails: [],
      documents: [
        {
          id: "doc-andes-an-002",
          type: "ArrivalNotice",
          format: "pdf",
          bucketKey: "operations/op-andes-textiles-002/arrival-notice-002.pdf",
          bookingId: "bkg-andes-002",
          extractedData: { freeDaysRemaining: 0 },
          receivedAt: at("2026-07-06"),
        },
      ],
    },
    createdAt: at("2026-06-09"),
  },
  {
    id: "op-cafe-del-valle-001",
    bookings: [
      buildBooking({
        id: "bkg-cafe-001",
        companyIds: ["company-cafe-del-valle", "company-flores-tropicales"],
        carrier: "MSC",
        vessel: "MSC Ambra",
        originPort: "COCTG",
        destinationPort: "NLRTM",
        etd: "2026-08-01",
        eta: "2026-08-26",
        containers: [
          ["MSCU5566778", "arrived_port"],
          ["MSCU5566779", "customs"],
        ],
      }),
      buildBooking({
        id: "bkg-cafe-002",
        companyIds: ["company-cafe-del-valle"],
        carrier: "MSC",
        vessel: "MSC Bettina",
        originPort: "COCTG",
        destinationPort: "ESVLC",
        etd: "2026-08-18",
        eta: "2026-09-12",
        containers: [["MSCU9900112", "booking_confirmed"]],
      }),
    ],
    context: {
      emails: [
        {
          source: "make",
          messageId: "email-cafe-007",
          from: "exports@cafedelvalle.co",
          subject: "Packing list Huila lot",
          receivedAt: at("2026-08-02"),
        },
      ],
      documents: [
        {
          id: "doc-cafe-pl-001",
          type: "PackingList",
          format: "spreadsheet",
          bucketKey: "operations/op-cafe-del-valle-001/packing-list-001.xlsx",
          bookingId: "bkg-cafe-001",
          sourceEmailId: "email-cafe-007",
          extractedData: { bags: 640, originFarm: "Huila" },
          receivedAt: at("2026-08-02"),
        },
      ],
    },
    createdAt: at("2026-07-28"),
  },
  {
    id: "op-flores-tropicales-001",
    bookings: [],
    context: {
      emails: [
        {
          source: "outlook",
          messageId: "email-flores-003",
          from: "compras@florestropicales.co",
          subject: "PO for September shipment",
          receivedAt: at("2026-08-25"),
          bodyText: "Attaching the PO, we need it on the water before September 30.",
        },
      ],
      documents: [
        {
          id: "doc-flores-po-001",
          type: "PO",
          format: "pdf",
          bucketKey: "operations/op-flores-tropicales-001/po-001.pdf",
          sourceEmailId: "email-flores-003",
          extractedData: { incoterm: "FOB", requestedEta: "2026-09-30" },
          receivedAt: at("2026-08-25"),
        },
      ],
    },
    createdAt: at("2026-08-25"),
  },
];

const COMPANIES: Company[] = [
  {
    id: "company-andes-textiles",
    name: "Andes Textiles",
    contactEmails: ["ops@andestextiles.co", "finanzas@andestextiles.co"],
    operationIds: ["op-andes-textiles-001", "op-andes-textiles-002"],
    preferredNotificationChannel: "email",
  },
  {
    id: "company-cafe-del-valle",
    name: "Café del Valle",
    contactEmails: ["exports@cafedelvalle.co"],
    operationIds: ["op-cafe-del-valle-001"],
    preferredNotificationChannel: "email",
  },
  {
    id: "company-flores-tropicales",
    name: "Flores Tropicales",
    contactEmails: ["compras@florestropicales.co"],
    operationIds: ["op-flores-tropicales-001"],
    preferredNotificationChannel: "slack",
  },
];

const mongo = await connectMongo();

try {
  const operations = new MongoOperationRepository(mongo.db);
  const companies = new MongoCompanyRepository(mongo.db);

  for (const operation of OPERATIONS) {
    await operations.save(operation);
  }
  for (const company of COMPANIES) {
    await companies.save(company);
  }

  const storedOperations = await operations.findAll();
  const storedCompanies = await companies.findAll();

  console.log(`seeded into "${mongo.db.databaseName}"`);
  console.log(`operations: ${storedOperations.length}, companies: ${storedCompanies.length}`);
} finally {
  await mongo.close();
}
