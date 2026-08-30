/** 8 MB. The backend accepts 12 MB of JSON, and base64 costs a third on top. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024

const CHUNK_BYTES = 0x8000

/**
 * A file as the upload endpoint wants it: base64, with no data-URL prefix.
 *
 * Encoded in chunks on purpose. `String.fromCharCode(...bytes)` spreads every
 * byte as an argument, and a few hundred KB overflows the call stack — a crash
 * on exactly the large files this exists for.
 */
export async function toBase64(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())

  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += CHUNK_BYTES) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK_BYTES))
  }

  return btoa(binary)
}

export function mimetypeOf(file: File): string {
  return file.type || 'application/octet-stream'
}
