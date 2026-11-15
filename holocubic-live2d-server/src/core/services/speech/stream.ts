import type { UIMessageChunk } from 'ai'
import { AppError, ErrorCodes } from '../../errors/index.ts'
import { logger } from '../../logger/index.ts'
import { SpeechTextFilter } from './text-filter.ts'
import type { TtsProvider, TtsSession } from './types.ts'

/** 给原有聊天流追加 transient 音频事件；音频结束后再发送原 finish。 */
export function addSpeechToStream(
  stream: ReadableStream<UIMessageChunk>,
  {
    provider,
    voice,
    signal: parentSignal,
  }: {
    provider: TtsProvider
    voice: string
    signal: AbortSignal
  },
): ReadableStream<UIMessageChunk> {
  const controller = new AbortController()
  const signal = AbortSignal.any([parentSignal, controller.signal])
  const reader = stream.getReader()
  const filter = new SpeechTextFilter()
  let session: TtsSession | undefined
  let closed = false
  let resolveAudio: () => void = () => {}
  let rejectAudio: (error: Error) => void = () => {}
  const audioDone = new Promise<void>((resolve, reject) => {
    resolveAudio = resolve
    rejectAudio = reject
  })
  void audioDone.catch(() => {})
  const cancel = () => {
    rejectAudio(
      signal.reason instanceof Error
        ? signal.reason
        : new AppError(ErrorCodes.UNKNOWN_ERROR, '聊天已取消'),
    )
  }
  signal.addEventListener('abort', cancel, { once: true })

  return new ReadableStream<UIMessageChunk>({
    start(output) {
      const write = (chunk: UIMessageChunk) => {
        if (!closed) output.enqueue(chunk)
      }
      const run = async () => {
        let finish: Extract<UIMessageChunk, { type: 'finish' }> | undefined
        let hasText = false
        let speechError: Error | undefined
        try {
          session = await provider.openSession(
            { voice, signal },
            {
              onAudio(data) {
                write({
                  type: 'data-audio',
                  data: {
                    audio: Buffer.from(data).toString('base64'),
                    format: 'pcm_s16le',
                    sampleRate: 24000,
                    channels: 1,
                  },
                  transient: true,
                })
              },
              onDone: resolveAudio,
              onError(error) {
                speechError = error
                rejectAudio(error)
                void reader.cancel().catch(() => {})
              },
            },
          )
          while (true) {
            const { value: chunk, done } = await reader.read()
            if (speechError) throw speechError
            if (done) break
            if (chunk.type === 'error')
              throw new AppError(ErrorCodes.UNKNOWN_ERROR, chunk.errorText)
            if (chunk.type === 'abort') {
              write(chunk)
              return
            }
            if (chunk.type === 'finish') {
              finish = chunk
              continue
            }
            write(chunk)
            if (chunk.type !== 'text-delta') continue
            const text = filter.push(chunk.delta)
            if (!text) continue
            if (text.trim()) hasText = true
            session.sendText(text)
          }
          if (!finish || finish.finishReason === 'error')
            throw new AppError(ErrorCodes.UNKNOWN_ERROR, '聊天流未正常结束')
          if (hasText) {
            session.finish()
            await audioDone
          }
          write({ type: 'data-audio-end', data: {}, transient: true })
          write(finish)
        } catch (cause) {
          if (!closed) {
            logger.warn({ err: cause }, 'Chat speech stream failed')
            output.enqueue({
              type: 'error',
              errorText:
                cause instanceof AppError
                  ? cause.message
                  : ErrorCodes.UNKNOWN_ERROR.desc,
            })
          }
        } finally {
          signal.removeEventListener('abort', cancel)
          controller.abort()
          session?.cancel()
          await reader.cancel().catch(() => {})
          reader.releaseLock()
          filter.finish()
          if (!closed) {
            closed = true
            output.close()
          }
        }
      }
      // start 不等待整个 run，以便消费者在等待音频时也能立即取消。
      void run()
    },
    cancel(reason) {
      closed = true
      controller.abort(reason)
      return reader.cancel(reason)
    },
  })
}
