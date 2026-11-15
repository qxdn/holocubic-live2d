import type { ServiceContext } from '../core/context.ts'
import { handleChatStream } from '@mastra/ai-sdk'
import { RequestContext } from '@mastra/core/request-context'
import { createUIMessageStreamResponse, validateUIMessages } from 'ai'
import { getCharacterModel } from '../core/services/character-model.ts'
import { AppError, ErrorCodes } from '../core/errors/index.ts'
import { logger } from '../core/logger/index.ts'
import { mastra } from '../core/mastra/index.ts'
import { getCharacter } from '../core/character/registry.ts'
import type { Handler } from 'hono'
import {
  ensureTraceId,
  getServiceContext,
} from '../middleware/request-context.ts'
import { chatRequestSchema } from '../models/chat.ts'
import { ttsProviderFactory } from '../core/services/speech/index.ts'
import { addSpeechToStream } from '../core/services/speech/stream.ts'

/** 原有聊天事件流追加 TTS 音频事件，客户端不需要转发正文。 */
export const chatHandler: Handler = async (c) => {
  const body = chatRequestSchema.parse(await c.req.json())
  const serviceContext = getServiceContext(c)
  const traceId = ensureTraceId(c)
  const character = getCharacter(body.characterId)
  const tts = body.enableTts ? character.speech?.tts : undefined
  if (body.enableTts && !tts) {
    throw new AppError(ErrorCodes.CHARACTER_TTS_NOT_CONFIGURED)
  }
  if (!['live2d', 'frame2d'].includes(character.model.type)) {
    throw new AppError(ErrorCodes.ILLEGAL_PARAM, '暂不支持该角色模型类型')
  }
  const modelId = character.model.modelId
  if (!(await getCharacterModel(serviceContext, character.model))) {
    throw new AppError(ErrorCodes.LIVE2D_MODEL_NOT_FOUND)
  }
  const messages = await validateUIMessages({ messages: body.messages })
  const requestContext = new RequestContext<{
    modelType: 'live2d' | 'frame2d'
    traceId: string
    modelId: string
    serviceContext: ServiceContext
  }>()
  requestContext.set('traceId', traceId)
  requestContext.set('modelId', modelId)
  requestContext.set('modelType', character.model.type)
  requestContext.set('serviceContext', serviceContext)
  const stream = await handleChatStream({
    mastra,
    agentId: character.id,
    version: 'v7',
    params: { messages, requestContext, abortSignal: c.req.raw.signal },
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
  return createUIMessageStreamResponse({
    stream: tts
      ? addSpeechToStream(stream, {
          provider: ttsProviderFactory(tts.provider),
          voice: tts.voice,
          signal: c.req.raw.signal,
        })
      : stream,
  })
}
