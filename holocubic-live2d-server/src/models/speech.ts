import { z } from '@hono/zod-openapi'
import { baseResponseSchema } from './response.ts'

export const asrQuerySchema = z.object({ characterId: z.string().trim().min(1) })

export const asrResponseSchema = baseResponseSchema
  .extend({ data: z.object({ text: z.string() }).nullable() })
  .openapi('AsrResponse')
