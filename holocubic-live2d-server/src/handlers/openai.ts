import { randomUUID } from 'node:crypto'
import { RequestContext } from '@mastra/core/request-context'
import type { Handler } from 'hono'
import { AppError, ErrorCodes } from '../core/errors/index.ts'
import { getCharacter } from '../core/character/registry.ts'
import { mastra } from '../core/mastra/index.ts'
import { getLive2dModel } from '../core/services/live2d.ts'
import { getServiceContext } from '../middleware/request-context.ts'

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

/** Adapts Chat Completions messages to the existing Agent runtime. */
export const openAIChatCompletionsHandler: Handler = async (c) => {
  const body = await c.req.json<{
    model: string
    messages: ChatMessage[]
    stream?: boolean
  }>()
  const character = getCharacter(body.model)
  const modelId = character.model.modelId
  const serviceContext = getServiceContext(c)
  if (!(await getLive2dModel(serviceContext, modelId))) {
    throw new AppError(ErrorCodes.LIVE2D_MODEL_NOT_FOUND)
  }

  const requestContext = new RequestContext<{
    modelId: string
    serviceContext: typeof serviceContext
  }>()
  requestContext.set('modelId', modelId)
  requestContext.set('serviceContext', serviceContext)

  const result = await mastra.getAgent(character.id).generate(body.messages, {
    requestContext,
  })
  const id = `chatcmpl-${randomUUID()}`
  const created = Math.floor(Date.now() / 1000)
  const content = result.text

  if (!body.stream) {
    return c.json({
      id,
      object: 'chat.completion' as const,
      created,
      model: body.model,
      choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
    })
  }

  const encoder = new TextEncoder()
  const chunk = (delta: Record<string, string>, finishReason: string | null = null) =>
    `data: ${JSON.stringify({
      id,
      object: 'chat.completion.chunk',
      created,
      model: body.model,
      choices: [{ index: 0, delta, finish_reason: finishReason }],
    })}\n\n`
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(chunk({ role: 'assistant' })))
      if (content) controller.enqueue(encoder.encode(chunk({ content })))
      controller.enqueue(encoder.encode(chunk({}, 'stop')))
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
