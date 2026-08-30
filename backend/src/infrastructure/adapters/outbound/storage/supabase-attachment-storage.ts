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

  // Built on first use, not in the constructor: this way booting the app
  // (and `make smoke`) doesn't require SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY
  // — it only fails if something actually tries to upload/sign without them.
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
