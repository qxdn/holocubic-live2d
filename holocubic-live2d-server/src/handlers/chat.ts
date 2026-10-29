import type { ServiceContext } from '../core/context.ts'
import { handleChatStream } from '@mastra/ai-sdk'
import { RequestContext } from '@mastra/core/request-context'
import { createUIMessageStreamResponse, validateUIMessages } from 'ai'
import type { Handler } from 'hono'
import { getLive2dModel } from '../core/services/live2d.ts'
import { AppError, ErrorCodes } from '../core/errors/index.ts'
import { logger } from '../core/logger/index.ts'
import { mastra } from '../core/mastra/index.ts'
import { ensureTraceId, getServiceContext } from '../middleware/request-context.ts'
import { chatRequestSchema } from '../models/chat.ts'

/** 将测试 Agent 的输出转换为 AI SDK UI message SSE 响应。 */
export const chatHandler: Handler = async (c) => {
  const body = chatRequestSchema.parse(await c.req.json())
  const serviceContext = getServiceContext(c)
  if (!(await getLive2dModel(serviceContext, body.modelId))) {
    throw new AppError(ErrorCodes.LIVE2D_MODEL_NOT_FOUND)
  }
  const messages = await validateUIMessages({ messages: body.messages })
  const traceId = ensureTraceId(c)
  const requestContext = new RequestContext<{
    traceId: string
    modelId: string
    serviceContext: ServiceContext
  }>()
  requestContext.set('traceId', traceId)
  requestContext.set('modelId', body.modelId)
  requestContext.set('serviceContext', serviceContext)
  const stream = await handleChatStream({
    mastra,
    agentId: 'testAgent',
    version: 'v7',
    params: { messages, requestContext },
    sendReasoning: true,
    onError: (error) => {
      if (error instanceof AppError) {
        logger.error(
          {
            traceId,
            code: error.code,
            err: error,
          },
          'Agent stream business error',
        )
        return error.message
      }

      logger.error({ traceId, err: error }, 'Agent stream unexpected error')
      return ErrorCodes.UNKNOWN_ERROR.desc
    },
  })
  return createUIMessageStreamResponse({ stream })
}
