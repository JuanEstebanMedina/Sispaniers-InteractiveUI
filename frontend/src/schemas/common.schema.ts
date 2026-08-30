import { z } from 'zod'

import { t } from '@/i18n'

export const idSchema = z.string().min(1)

export const isoDateSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: 'Invalid ISO date',
})

export const currencyCodeSchema = z
  .string()
  .length(3)
  .transform((value) => value.toUpperCase())

export const minorAmountSchema = z
  .number()
  .int('Amounts must be integers in the currency minor unit')
  .finite()

export const moneySchema = z.object({
  amount: minorAmountSchema,
  currency: currencyCodeSchema,
})

export type Money = z.infer<typeof moneySchema>

export const ratioSchema = z.number().min(0).max(1)

export const sortDirectionSchema = z.enum(['asc', 'desc'])
export type SortDirection = z.infer<typeof sortDirectionSchema>

export const pageMetaSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
})

export type PageMeta = z.infer<typeof pageMetaSchema>

export function paginatedSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    data: z.array(item),
    meta: pageMetaSchema,
  })
}

export type Paginated<T> = { data: T[]; meta: PageMeta }

export const validators = {
  requiredString: (message?: string) => z.string().min(1, message ?? t('validation:required')),

  email: () => z.email(t('validation:email')),

  password: (minLength = 6) =>
    z.string().min(minLength, t('validation:passwordMin', { count: minLength })),

  minLength: (length: number) => z.string().min(length, t('validation:min', { count: length })),

  maxLength: (length: number) => z.string().max(length, t('validation:max', { count: length })),

  positiveNumber: () => z.number(t('validation:number')).positive(t('validation:positive')),
}

export function parseResponse<T extends z.ZodTypeAny>(
  schema: T,
  payload: unknown,
  context: string,
): z.infer<T> {
  const result = schema.safeParse(payload)

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  · ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n')

    console.error(
      `[schema] Unexpected response shape from ${context}:\n${issues}\n`,
      { received: payload },
    )

    throw new z.ZodError(result.error.issues)
  }

  return result.data
}
