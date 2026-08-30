export interface UploadAttachmentInput {
  path: string;
  mimetype: string;
  data: Buffer;
}

export interface AttachmentStorage {
  upload(input: UploadAttachmentInput): Promise<void>;
  createSignedUrl(path: string, expiresInSeconds: number): Promise<string>;
}
