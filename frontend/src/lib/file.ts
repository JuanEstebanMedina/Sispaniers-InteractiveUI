/**
 * The upload endpoint takes base64, so a picked file has to be read and encoded
 * before it can be sent.
 */

/** 8 MB. Past that the base64 body is ~11 MB and the request starts timing out. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024

/**
 * 32 KB per call to `btoa`.
 *
 * The obvious `btoa(String.fromCharCode(...bytes))` throws `RangeError` on
 * anything past a few hundred KB, because every byte becomes an argument and
 * the call blows the stack limit. A PDF is comfortably past that, so the bytes
 * go in slices.
 */
const CHUNK_BYTES = 0x8000

/**
 * Reads a File into base64, without the `data:` prefix the API does not want.
 *
 * `arrayBuffer()` rather than `FileReader`: it exists on both the browser's
 * File and Node's, so this is the same code in the app and under test — a
 * `FileReader` version can only be exercised with a DOM bolted on.
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
