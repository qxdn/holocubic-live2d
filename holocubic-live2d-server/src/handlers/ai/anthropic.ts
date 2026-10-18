import { randomUUID } from 'node:crypto'
import type { Context } from 'hono'
import { streamSSE } from 'hono/streaming'
import { anthropicRequestSchema } from '../../models/index.ts'
import type { AIRequest } from '../../services/ai.ts'
import { generateReply, streamReply } from '../../services/ai.ts'
import { error, parseRequest } from './shared.ts'

export async function anthropicHandler(c: Context) {
  const { data: input, error: parseError } = await parseRequest(
    c,
    anthropicRequestSchema,
  )
  if (parseError !== null) return error(c, 'anthropic', 400, parseError)
  const toText = (content: string | { type: 'text'; text: string }[]) =>
    typeof content === 'string'
      ? content
      : content.map((part) => part.text).join('\n')
  const request: AIRequest = {
    model: input.model,
    messages: input.messages.map((message) => ({
      role: message.role,
      content: toText(message.content),
    })),
    maxOutputTokens: input.max_tokens,
    temperature: input.temperature,
    topP: input.top_p,
    stopSequences: input.stop_sequences,
    abortSignal: c.req.raw.signal,
  }
  if (input.system) {
    request.messages.unshift({ role: 'system', content: toText(input.system) })
  }
  try {
    return input.stream
      ? anthropicStreamHandler(c, request)
      : await anthropicSyncHandler(c, request)
  } catch {
    return error(c, 'anthropic', 502, 'AI upstream request failed')
  }
}

// 非流式：等待生成完成后返回 JSON。
async function anthropicSyncHandler(c: Context, request: AIRequest) {
  const id = `msg_${randomUUID().replaceAll('-', '')}`
  const finish = (reason: string) =>
    reason === 'length' ? 'max_tokens' : 'end_turn'
  const result = await generateReply(request)
  return c.json({
    id,
    type: 'message',
    role: 'assistant',
    model: request.model,
    content: [{ type: 'text', text: result.text }],
    stop_reason: finish(result.finishReason),
    stop_sequence: null,
    usage: {
      input_tokens: result.usage.inputTokens ?? 0,
      output_tokens: result.usage.outputTokens ?? 0,
    },
  })
}

// 流式：通过 SSE 逐段发送生成结果。
function anthropicStreamHandler(c: Context, request: AIRequest) {
  const id = `msg_${randomUUID().replaceAll('-', '')}`
  const finish = (reason: string) =>
    reason === 'length' ? 'max_tokens' : 'end_turn'
  const abort = new AbortController()
  const result = streamReply({
    ...request,
    abortSignal: AbortSignal.any([c.req.raw.signal, abort.signal]),
  })
  return streamSSE(c, async (stream) => {
    stream.onAbort(() => {
      abort.abort()
    })
    const send = async (data: object, event: string) => {
      await stream.writeSSE({ data: JSON.stringify(data), event })
    }
    try {
      await send(
        {
          type: 'message_start',
          message: {
            id,
            type: 'message',
            role: 'assistant',
            model: request.model,
            content: [],
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 0, output_tokens: 0 },
          },
        },
        'message_start',
      )
      await send(
        {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'text', text: '' },
        },
        'content_block_start',
      )
      for await (const part of result.fullStream) {
        if (abort.signal.aborted) break
        if (part.type === 'error') throw part.error
        if (part.type === 'text-delta') {
          await send(
            {
              type: 'content_block_delta',
              index: 0,
              delta: { type: 'text_delta', text: part.text },
            },
            'content_block_delta',
          )
        }
      }
      if (abort.signal.aborted) return
      const reason = finish(await result.finishReason)
      const usage = await result.totalUsage
      await send({ type: 'content_block_stop', index: 0 }, 'content_block_stop')
      await send(
        {
          type: 'message_delta',
          delta: { stop_reason: reason, stop_sequence: null },
          usage: {
            input_tokens: usage.inputTokens ?? 0,
            output_tokens: usage.outputTokens ?? 0,
          },
        },
        'message_delta',
      )
      await send({ type: 'message_stop' }, 'message_stop')
    } catch {
      await send(
        {
          type: 'error',
          error: { type: 'api_error', message: 'AI upstream request failed' },
        },
        'error',
      )
    }
  })
}
