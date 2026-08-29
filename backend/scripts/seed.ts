import type { Booking, Operation } from "../src/domain/logistics/operation.js";
import { MongoOperationRepository } from "../src/infrastructure/adapters/outbound/mongo/operation.repository.js";
import { connectMongo } from "../src/infrastructure/config/mongo.js";

function at(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

interface BookingSeed {
  id: string;
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
    clientId: "client-andes-textiles",
    bookings: [
      buildBooking({
        id: "bkg-andes-001",
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
    documents: [
      {
        id: "doc-andes-bl-001",
        type: "BillOfLading",
        bookingId: "bkg-andes-001",
        sourceEmailId: "email-andes-014",
        extractedData: { grossWeightKg: 21400, packages: 880 },
        receivedAt: at("2026-07-04"),
      },
      {
        id: "doc-andes-inv-001",
        type: "Invoice",
        bookingId: "bkg-andes-001",
        extractedData: { currency: "USD", total: 48250 },
        receivedAt: at("2026-07-05"),
      },
    ],
    createdAt: at("2026-07-01"),
  },
  {
    id: "op-andes-textiles-002",
    clientId: "client-andes-textiles",
    bookings: [
      buildBooking({
        id: "bkg-andes-002",
        carrier: "Hapag-Lloyd",
        vessel: "Bremen Express",
        originPort: "DEHAM",
        destinationPort: "COBAQ",
        etd: "2026-06-10",
        eta: "2026-07-08",
        containers: [["HLXU8811223", "delivered"]],
      }),
    ],
    documents: [
      {
        id: "doc-andes-an-002",
        type: "ArrivalNotice",
        bookingId: "bkg-andes-002",
        extractedData: { freeDaysRemaining: 0 },
        receivedAt: at("2026-07-06"),
      },
    ],
    createdAt: at("2026-06-09"),
  },
  {
    id: "op-cafe-del-valle-001",
    clientId: "client-cafe-del-valle",
    bookings: [
      buildBooking({
        id: "bkg-cafe-001",
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
        carrier: "MSC",
        vessel: "MSC Bettina",
        originPort: "COCTG",
        destinationPort: "ESVLC",
        etd: "2026-08-18",
        eta: "2026-09-12",
        containers: [["MSCU9900112", "booking_confirmed"]],
      }),
    ],
    documents: [
      {
        id: "doc-cafe-pl-001",
        type: "PackingList",
        bookingId: "bkg-cafe-001",
        extractedData: { bags: 640, originFarm: "Huila" },
        receivedAt: at("2026-08-02"),
      },
    ],
    createdAt: at("2026-07-28"),
  },
  {
    id: "op-flores-tropicales-001",
    clientId: "client-flores-tropicales",
    bookings: [],
    documents: [
      {
        id: "doc-flores-po-001",
        type: "PO",
        sourceEmailId: "email-flores-003",
        extractedData: { incoterm: "FOB", requestedEta: "2026-09-30" },
        receivedAt: at("2026-08-25"),
      },
    ],
    createdAt: at("2026-08-25"),
  },
];

const mongo = await connectMongo();

try {
  const repository = new MongoOperationRepository(mongo.db);

  for (const operation of OPERATIONS) {
    await repository.save(operation);
  }

  const stored = await repository.findAll();

  console.log(`seeded ${OPERATIONS.length} operations into "${mongo.db.databaseName}"`);
  console.log(`the collection now holds ${stored.length} operations`);
} finally {
  await mongo.close();
}
