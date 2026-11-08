import { z } from '@hono/zod-openapi'

/** 消息内容由 AI SDK 的 validateUIMessages 进一步校验。 */
export const chatRequestSchema = z.object({
  characterId: z.string().min(1),
  messages: z.array(z.unknown()).min(1),
})
