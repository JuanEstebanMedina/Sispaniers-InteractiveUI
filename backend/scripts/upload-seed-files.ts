import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

/**
 * ONE-OFF: uploads a real, basic file to Supabase Storage for every document
 * in `seed-data.json`, at its own `bucketKey`. Without this, the preview
 * feature (`GET /operations/:id/documents/:id/preview-url`) signs a URL to
 * an object that was never actually there.
 *
 * Content is generated, not hand-authored per document — a minimal PDF (a
 * title plus a couple of lines) or a minimal two-column spreadsheet built
 * from the document's own `extractedData`, whichever `format` it declares.
 */

const DATA_FILE = new URL("./seed-data.json", import.meta.url);
const BUCKET = "email-attachments";

interface DocumentSeed {
  bucketKey: string;
  format: string;
  type: string;
  extractedData?: Record<string, unknown>;
}

interface SeedFile {
  operations: Array<{ context: { documents: DocumentSeed[] } }>;
}

function collectDocuments(seedFile: SeedFile): DocumentSeed[] {
  return seedFile.operations.flatMap((operation) => operation.context.documents);
}

/** A single-page PDF, built by hand — this app has no PDF-writing dependency. */
function minimalPdf(title: string, lines: string[]): Buffer {
  const body = [title, "", ...lines]
    .map(
      (line, index) =>
        `BT /F1 ${index === 0 ? 16 : 11} Tf 40 ${740 - index * 20} Td (${escapePdfText(line)}) Tj ET`,
    )
    .join("\n");
  const stream = `q\n${body}\nQ`;

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, "latin1");
}

function escapePdfText(text: string): string {
  return text.replace(/[()\\]/g, "");
}

/** A "Field"/"Value" sheet out of whatever the document's own extractedData carries. */
function minimalXlsx(title: string, fields: Record<string, unknown>): Buffer {
  const rows: (string | number)[][] = [
    [title],
    [],
    ["Field", "Value"],
    ...Object.entries(fields).map(([key, value]) => [key, String(value)]),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function buildFile(document: DocumentSeed): { data: Buffer; mimetype: string } {
  const title = document.type.replace(/([a-z])([A-Z])/g, "$1 $2");

  if (document.format === "spreadsheet") {
    return {
      data: minimalXlsx(title, document.extractedData ?? {}),
      mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }

  const fields = Object.entries(document.extractedData ?? {}).map(
    ([key, value]) => `${key}: ${String(value)}`,
  );
  return {
    data: minimalPdf(title, ["Demo document generated for the Sispaniers seed.", ...fields]),
    mimetype: "application/pdf",
  };
}

const seedFile: SeedFile = JSON.parse(readFileSync(DATA_FILE, "utf8"));
const documents = collectDocuments(seedFile);

const url = process.env.SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!url || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to upload seed files");
}

const client = createClient(url, serviceRoleKey);

const { data: buckets } = await client.storage.listBuckets();
if (!buckets?.some((bucket) => bucket.name === BUCKET)) {
  const { error } = await client.storage.createBucket(BUCKET, { public: false });
  if (error) throw new Error(`could not create bucket "${BUCKET}": ${error.message}`);
  console.log(`created bucket "${BUCKET}"`);
}

for (const document of documents) {
  const { data, mimetype } = buildFile(document);
  const { error } = await client.storage
    .from(BUCKET)
    .upload(document.bucketKey, data, { contentType: mimetype, upsert: true });

  if (error) {
    console.error(`failed: ${document.bucketKey} — ${error.message}`);
    continue;
  }
  console.log(`uploaded: ${document.bucketKey} (${data.length} bytes)`);
}
