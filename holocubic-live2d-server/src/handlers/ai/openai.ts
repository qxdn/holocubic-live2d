import { randomUUID } from 'node:crypto'
import type { Context } from 'hono'
import { streamSSE } from 'hono/streaming'
import { openAIRequestSchema } from '../../models/index.js'
import type { AIRequest } from '../../services/ai.js'
import { generateReply, streamReply } from '../../services/ai.js'
import { error, parseRequest } from './shared.js'

export async function openAIHandler(c: Context) {
  const { data: input, error: parseError } = await parseRequest(
    c,
    openAIRequestSchema,
  )
  if (parseError !== null) return error(c, 'openai', 400, parseError)
  const request: AIRequest = {
    model: input.model,
    messages: input.messages,
    maxOutputTokens: input.max_completion_tokens,
    temperature: input.temperature,
    topP: input.top_p,
    stopSequences: typeof input.stop === 'string' ? [input.stop] : input.stop,
    abortSignal: c.req.raw.signal,
  }
  try {
    return input.stream
      ? openAIStreamHandler(c, request)
      : await openAISyncHandler(c, request)
  } catch {
    return error(c, 'openai', 502, 'AI upstream request failed')
  }
}

// 非流式：等待生成完成后返回 JSON。
async function openAISyncHandler(c: Context, request: AIRequest) {
  const id = `chatcmpl_${randomUUID().replaceAll('-', '')}`
  const created = Math.floor(Date.now() / 1000)
  const finish = (reason: string) => (reason === 'length' ? 'length' : 'stop')
  const result = await generateReply(request)
  const promptTokens = result.usage.inputTokens ?? 0
  const completionTokens = result.usage.outputTokens ?? 0
  return c.json({
    id,
    object: 'chat.completion',
    created,
    model: request.model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: result.text },
        finish_reason: finish(result.finishReason),
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    },
  })
}

// 流式：通过 SSE 逐段发送生成结果。
function openAIStreamHandler(c: Context, request: AIRequest) {
  const id = `chatcmpl_${randomUUID().replaceAll('-', '')}`
  const created = Math.floor(Date.now() / 1000)
  const finish = (reason: string) => (reason === 'length' ? 'length' : 'stop')
  const abort = new AbortController()
  const result = streamReply({
    ...request,
    abortSignal: AbortSignal.any([c.req.raw.signal, abort.signal]),
  })
  return streamSSE(c, async (stream) => {
    stream.onAbort(() => {
      abort.abort()
    })
    const send = async (data: object) => {
      await stream.writeSSE({ data: JSON.stringify(data) })
    }
    const chunk = (delta: object, reason: string | null = null) => ({
      id,
      object: 'chat.completion.chunk',
      created,
      model: request.model,
      choices: [{ index: 0, delta, finish_reason: reason }],
    })
    try {
      await send(chunk({ role: 'assistant', content: '' }))
      for await (const part of result.fullStream) {
        if (abort.signal.aborted) break
        if (part.type === 'error') throw part.error
        if (part.type === 'text-delta')
          await send(chunk({ content: part.text }))
      }
      if (abort.signal.aborted) return
      await send(chunk({}, finish(await result.finishReason)))
      await stream.writeSSE({ data: '[DONE]' })
    } catch {
      await send({
        error: { type: 'api_error', message: 'AI upstream request failed' },
      })
    }
  })
}
