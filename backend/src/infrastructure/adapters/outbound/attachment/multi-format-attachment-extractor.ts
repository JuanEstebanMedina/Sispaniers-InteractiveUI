import mammoth from "mammoth";
import { parseOffice } from "officeparser";
import { PDFParse } from "pdf-parse";
import { read as readWorkbook, utils as sheetUtils } from "xlsx";
import type { ExtractedAttachment } from "../../../../domain/model/attachment-content.js";
import type { EmailAttachment } from "../../../../domain/model/email.js";
import type { AttachmentExtractor } from "../../../../domain/ports/attachment-extractor.port.js";

const DOCX_MIMETYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PPTX_MIMETYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const XLSX_MIMETYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);
const CSV_MIMETYPES = new Set(["text/csv", "application/csv"]);

async function extractSpreadsheet(buffer: Buffer): Promise<string> {
  const workbook = readWorkbook(buffer, { type: "buffer" });
  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const csv = sheet !== undefined ? sheetUtils.sheet_to_csv(sheet) : "";
    return `--- ${name} ---\n${csv}`;
  }).join("\n\n");
}

async function extractByMimetype(mimetype: string, buffer: Buffer): Promise<string | undefined> {
  if (mimetype.startsWith("image/")) {
    return undefined;
  }
  if (mimetype === "application/pdf") {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  }
  if (mimetype === DOCX_MIMETYPE) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  if (mimetype === PPTX_MIMETYPE) {
    const ast = await parseOffice(buffer);
    return ast.toText();
  }
  if (XLSX_MIMETYPES.has(mimetype)) {
    return extractSpreadsheet(buffer);
  }
  if (CSV_MIMETYPES.has(mimetype)) {
    return buffer.toString("utf-8");
  }
  return undefined;
}

export class MultiFormatAttachmentExtractor implements AttachmentExtractor {
  async extract(attachment: EmailAttachment): Promise<ExtractedAttachment> {
    const base = {
      ...(attachment.filename !== undefined ? { filename: attachment.filename } : {}),
      ...(attachment.mimetype !== undefined ? { mimetype: attachment.mimetype } : {}),
    };

    if (attachment.mimetype === undefined || attachment.data === undefined) {
      return { ...base, kind: "unsupported", error: "missing mimetype or data" };
    }

    if (attachment.mimetype.startsWith("image/")) {
      return { ...base, kind: "image", content: attachment.data };
    }

    const buffer = Buffer.from(attachment.data, "base64");

    try {
      const content = await extractByMimetype(attachment.mimetype, buffer);
      if (content === undefined) {
        return {
          ...base,
          kind: "unsupported",
          error: `unsupported mimetype: ${attachment.mimetype}`,
        };
      }
      return { ...base, kind: "text", content };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const magicBytes = buffer.subarray(0, 8).toString("hex");
      return {
        ...base,
        kind: "unsupported",
        error: `${reason} (decoded ${buffer.length} bytes, starts with hex ${magicBytes})`,
      };
    }
  }
}
