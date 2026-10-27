import { handleChatStream } from '@mastra/ai-sdk'
import { RequestContext } from '@mastra/core/request-context'
import { createUIMessageStreamResponse, validateUIMessages } from 'ai'
import type { Handler } from 'hono'
import { getLive2dModel } from '../core/services/live2d.ts'
import { AppError, ErrorCodes } from '../core/errors/index.ts'
import { mastra } from '../core/mastra/index.ts'
import { ensureTraceId } from '../middleware/request-context.ts'
import { chatRequestSchema } from '../models/chat.ts'

/** 将测试 Agent 的输出转换为 AI SDK UI message SSE 响应。 */
export const chatHandler: Handler = async (c) => {
  const body = chatRequestSchema.parse(await c.req.json())
  if (!getLive2dModel(body.modelId)) {
    throw new AppError(ErrorCodes.LIVE2D_MODEL_NOT_FOUND)
  }
  const messages = await validateUIMessages({ messages: body.messages })
  const traceId = ensureTraceId(c)
  const requestContext = new RequestContext<{
    traceId: string
    modelId: string
  }>()
  requestContext.set('traceId', traceId)
  requestContext.set('modelId', body.modelId)
  const stream = await handleChatStream({
    mastra,
    agentId: 'testAgent',
    version: 'v7',
    params: { messages, requestContext },
    sendReasoning: true,
    onError: (error) => {
      if (error instanceof AppError) {
        console.error('Agent stream business error', {
          traceId,
          code: error.code,
          error,
        })
        return error.message
      }

      console.error('Agent stream unexpected error', { traceId, error })
      return ErrorCodes.UNKNOWN_ERROR.desc
    },
  })
  return createUIMessageStreamResponse({ stream })
}
