import { describe, expect, test } from 'vitest'

import { MAX_UPLOAD_BYTES, mimetypeOf, toBase64 } from '@/lib/file'

describe('reading a picked file', () => {
  test('strips the data URL prefix the API does not want', async () => {
    const file = new File(['hola'], 'nota.txt', { type: 'text/plain' })

    const encoded = await toBase64(file)

    expect(encoded).toBe(btoa('hola'))
    expect(encoded).not.toContain('data:')
    expect(encoded).not.toContain(',')
  })

  test('survives a payload that would blow the argument limit', async () => {
    const big = new File([new Uint8Array(600_000)], 'grande.pdf', {
      type: 'application/pdf',
    })

    const encoded = await toBase64(big)

    expect(encoded.length).toBeGreaterThan(700_000)
  })

  test('binary survives the round trip byte for byte', async () => {
    const bytes = new Uint8Array([0, 255, 127, 128, 10, 13])
    const file = new File([bytes], 'raw.bin')

    const decoded = Uint8Array.from(atob(await toBase64(file)), (c) => c.charCodeAt(0))

    expect([...decoded]).toEqual([...bytes])
  })
})

describe('mimetype', () => {
  test('uses what the browser said', () => {
    expect(mimetypeOf(new File([''], 'a.pdf', { type: 'application/pdf' }))).toBe(
      'application/pdf',
    )
  })

  test('an unrecognised extension becomes a generic binary, not an empty string', () => {
    expect(mimetypeOf(new File([''], 'manifiesto.edi'))).toBe('application/octet-stream')
  })
})

describe('the size cap', () => {
  test('is 8 MB, the point where the base64 body starts timing out', () => {
    expect(MAX_UPLOAD_BYTES).toBe(8 * 1024 * 1024)
  })
})
