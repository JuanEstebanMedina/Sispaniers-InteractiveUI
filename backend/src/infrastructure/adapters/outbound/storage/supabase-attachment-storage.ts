import { type SupabaseClient, createClient } from "@supabase/supabase-js";
import type {
  AttachmentStorage,
  UploadAttachmentInput,
} from "../../../../domain/ports/attachment-storage.port.js";

const BUCKET = "email-attachments";

export class SupabaseAttachmentStorage implements AttachmentStorage {
  private client: SupabaseClient | undefined;

  constructor(
    private readonly url: string,
    private readonly serviceRoleKey: string,
  ) {}

  // Construido al primer uso, no en el constructor: así booteaar la app (y
  // `make smoke`) no exige tener SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY —
  // solo falla si de verdad se intenta subir/firmar un archivo sin ellas.
  private getClient(): SupabaseClient {
    if (this.client === undefined) {
      this.client = createClient(this.url, this.serviceRoleKey);
    }
    return this.client;
  }

  async upload(input: UploadAttachmentInput): Promise<void> {
    const { error } = await this.getClient()
      .storage.from(BUCKET)
      .upload(input.path, input.data, { contentType: input.mimetype, upsert: true });

    if (error !== null) {
      throw new Error(`Supabase upload failed: ${error.message}`);
    }
  }

  async createSignedUrl(path: string, expiresInSeconds: number): Promise<string> {
    const { data, error } = await this.getClient()
      .storage.from(BUCKET)
      .createSignedUrl(path, expiresInSeconds);

    if (error !== null || data === null) {
      throw new Error(`Supabase signed URL failed: ${error?.message ?? "unknown error"}`);
    }

    return data.signedUrl;
  }
}
