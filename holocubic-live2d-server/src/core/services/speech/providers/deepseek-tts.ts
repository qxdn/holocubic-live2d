import { randomUUID } from 'node:crypto'
import WebSocket from 'ws'
import { AppError, ErrorCodes } from '../../../errors/index.ts'
import { logger } from '../../../logger/index.ts'
import type {
  TtsCallbacks,
  TtsOptions,
  TtsProvider,
  TtsSession,
} from '../types.ts'

export interface DeepseekTtsOptions {
  readonly apiKey: string
  readonly endpoint?: string
}

/** @see https://api-docs.deepseek.com/zh-cn/guides/tts/ */
export class DeepseekTtsProvider implements TtsProvider {
  constructor(private readonly config: DeepseekTtsOptions) {
    if (!config.apiKey.trim())
      throw new AppError(ErrorCodes.TTS_PROVIDER_CONFIG_INVALID)
  }

  openSession(
    options: TtsOptions,
    callbacks: TtsCallbacks,
  ): Promise<TtsSession> {
    const voice = options.voice.trim()
    if (!['stella', 'tide'].includes(voice))
      return Promise.reject(
        new AppError(ErrorCodes.ILLEGAL_PARAM, '不支持的 DeepSeek 音色'),
      )
    if (options.signal?.aborted)
      return Promise.reject(new AppError(ErrorCodes.TTS_CANCELED))

    return new Promise((resolve, reject) => {
      const url = new URL(
        this.config.endpoint ?? 'wss://api.deepseek.com/v1/tools/tts',
      )
      url.searchParams.set('voice_id', voice)
      url.searchParams.set('format', 'pcm')
      url.searchParams.set('filter_markdown', 'true')
      const log = logger.child({
        provider: 'deepseek',
        sessionId: randomUUID(),
      })
      const ws = new WebSocket(url, {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
        handshakeTimeout: 15000,
        perMessageDeflate: false,
      })
      let state: 'connecting' | 'ready' | 'finishing' | 'closed' = 'connecting'
      let opened = false
      let timer: ReturnType<typeof setTimeout>
      const clean = () => {
        state = 'closed'
        clearTimeout(timer)
        clearTimeout(lifetime)
        options.signal?.removeEventListener('abort', cancel)
        ws.terminate()
      }
      const fail = (cause: unknown) => {
        if (state === 'closed') return
        const error =
          cause instanceof AppError
            ? cause
            : new AppError(ErrorCodes.TTS_PROVIDER_FAILED, undefined, { cause })
        log.warn({ err: error }, 'DeepSeek TTS session failed')
        clean()
        if (opened) callbacks.onError(error)
        else reject(error)
      }
      const armTimeout = () => {
        clearTimeout(timer)
        timer = setTimeout(
          () => fail(new AppError(ErrorCodes.TTS_TIMEOUT)),
          60000,
        )
      }
      const cancel = () => {
        if (state === 'closed') return
        clean()
        if (!opened) reject(new AppError(ErrorCodes.TTS_CANCELED))
      }
      const lifetime = setTimeout(
        () => fail(new AppError(ErrorCodes.TTS_TIMEOUT)),
        30 * 60000,
      )
      const send = (message: Record<string, string>) => {
        try {
          if (ws.readyState !== WebSocket.OPEN)
            throw new AppError(
              ErrorCodes.TTS_PROVIDER_FAILED,
              'DeepSeek TTS connection is not open',
            )
          ws.send(JSON.stringify(message), (error) => {
            if (error) fail(error)
          })
          armTimeout()
        } catch (error) {
          fail(error)
        }
      }
      const session: TtsSession = {
        sendText(text) {
          if (state !== 'ready')
            throw new AppError(
              ErrorCodes.TTS_PROVIDER_FAILED,
              '语音会话已结束输入',
            )
          if (text) send({ event: 'text', text })
        },
        finish() {
          if (state !== 'ready') return
          state = 'finishing'
          send({ event: 'finish_text' })
        },
        cancel,
      }
      options.signal?.addEventListener('abort', cancel, { once: true })
      ws.on('open', () => {
        if (state === 'closed') return
        opened = true
        state = 'ready'
        armTimeout()
        log.info('TTS WebSocket connected')
        resolve(session)
      })
      ws.on('unexpected-response', (_request, response) => {
        response.resume()
        fail(
          new AppError(
            ErrorCodes.TTS_PROVIDER_FAILED,
            `DeepSeek TTS handshake rejected: HTTP ${response.statusCode}`,
          ),
        )
      })
      ws.on('message', (data, binary) => {
        if (state === 'closed') return
        try {
          const bytes = Array.isArray(data)
            ? Buffer.concat(data)
            : Buffer.isBuffer(data)
              ? data
              : Buffer.from(data)
          if (binary) {
            if (bytes.length % 2)
              throw new AppError(
                ErrorCodes.TTS_PROVIDER_FAILED,
                'Invalid DeepSeek PCM16 audio',
              )
            if (bytes.length) callbacks.onAudio(bytes)
            if (ws.readyState === WebSocket.OPEN) armTimeout()
            return
          }
          const event: unknown = JSON.parse(bytes.toString('utf8'))
          if (
            !event ||
            typeof event !== 'object' ||
            !('event' in event) ||
            event.event !== 'finish' ||
            !('code' in event) ||
            typeof event.code !== 'string'
          )
            throw new AppError(
              ErrorCodes.TTS_PROVIDER_FAILED,
              'Invalid DeepSeek TTS event',
            )
          if (event.code !== 'success') {
            log.warn({ code: event.code }, 'DeepSeek TTS rejected synthesis')
            throw new AppError(
              ErrorCodes.TTS_PROVIDER_FAILED,
              `DeepSeek 语音合成失败：${event.code}`,
            )
          }
          if (state !== 'finishing')
            throw new AppError(
              ErrorCodes.TTS_PROVIDER_FAILED,
              'DeepSeek TTS finished before text input ended',
            )
          clean()
          callbacks.onDone()
        } catch (error) {
          fail(error)
        }
      })
      ws.on('error', fail)
      ws.on('close', () => {
        if (state !== 'closed')
          fail(
            new AppError(
              ErrorCodes.TTS_PROVIDER_FAILED,
              'DeepSeek TTS upstream closed before completion',
            ),
          )
      })
    })
  }
}
