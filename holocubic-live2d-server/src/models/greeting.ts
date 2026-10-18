import { z } from '@hono/zod-openapi'
import { baseResponseSchema } from './response.ts'

export const greetingResponseSchema = baseResponseSchema
  .extend({ data: z.object({ greeting: z.string() }).nullable() })
  .openapi('GreetingResponse')
