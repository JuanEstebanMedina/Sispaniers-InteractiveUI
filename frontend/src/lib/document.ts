import type { LogisticsDocument } from '@/schemas'

/**
 * El nombre con el que la persona subió el archivo.
 *
 * `filename` es el campo real, pero llegó después: los documentos guardados
 * antes de que existiera no lo tienen, y para esos el último segmento de
 * `bucketKey` (`<ruta>/<archivo>`) sigue siendo la mejor pista. El tipo del
 * documento (`PO`, `Invoice`, …) nunca es un sustituto válido del nombre — es
 * una clasificación de negocio, no una identidad de archivo.
 */
export function documentFilename(document: LogisticsDocument): string {
  return document.filename || document.bucketKey.split('/').pop() || document.id
}
