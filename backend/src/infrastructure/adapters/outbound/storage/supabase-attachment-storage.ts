import { type SupabaseClient, createClient } from "@supabase/supabase-js";
import type {
  AttachmentStorage,
  UploadAttachmentInput,
} from "../../../../domain/ports/attachment-storage.port.js";

const BUCKET = "email-attachments";

export class SupabaseAttachmentStorage implements AttachmentStorage {
  private readonly client: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient(url, serviceRoleKey);
  }

  async upload(input: UploadAttachmentInput): Promise<void> {
    const { error } = await this.client.storage
      .from(BUCKET)
      .upload(input.path, input.data, { contentType: input.mimetype, upsert: true });

    if (error !== null) {
      throw new Error(`Supabase upload failed: ${error.message}`);
    }
  }

  async createSignedUrl(path: string, expiresInSeconds: number): Promise<string> {
    const { data, error } = await this.client.storage
      .from(BUCKET)
      .createSignedUrl(path, expiresInSeconds);

    if (error !== null || data === null) {
      throw new Error(`Supabase signed URL failed: ${error?.message ?? "unknown error"}`);
    }

    return data.signedUrl;
  }
}
