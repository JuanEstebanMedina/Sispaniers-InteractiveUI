import { z } from 'zod'

export const companyConceptsResponseSchema = z.object({
  concepts: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      values: z.array(z.record(z.string(), z.unknown())),
    }),
  ),
})
