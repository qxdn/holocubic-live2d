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
import {
  decodeTtsFrame,
  encodeTtsFrame,
  TtsEvent,
} from './volcengine-tts-protocol.ts'

export interface VolcengineTtsOptions {
  readonly apiKey: string
  readonly resourceId?: string
  readonly endpoint?: string
}

/** 每轮回复独立建立双向流会话，文本输入和 PCM 输出可同时进行。
 * @see https://docs.volcengine.com/docs/doubao-voice/bidirectional-streaming-text-to-speech-websocket?lang=zh
 */
export class VolcengineTtsProvider implements TtsProvider {
  constructor(private readonly config: VolcengineTtsOptions) {
    if (!config.apiKey.trim())
      throw new AppError(ErrorCodes.TTS_PROVIDER_CONFIG_INVALID)
  }

  openSession(
    options: TtsOptions,
    callbacks: TtsCallbacks,
  ): Promise<TtsSession> {
    if (!options.voice.trim())
      return Promise.reject(new AppError(ErrorCodes.ILLEGAL_PARAM))
    if (options.signal?.aborted)
      return Promise.reject(
        new Error('TTS session aborted', { cause: options.signal.reason }),
      )
    return new Promise((resolve, reject) => {
      const sessionId = randomUUID()
      const log = logger.child({ provider: 'volcengine', sessionId })
      const ws = new WebSocket(
        this.config.endpoint ??
          'wss://openspeech.bytedance.com/api/v3/tts/bidirection',
        {
          headers: {
            'X-Api-Key': this.config.apiKey,
            'X-Api-Resource-Id': this.config.resourceId ?? 'seed-tts-2.0',
            'X-Api-Connect-Id': randomUUID(),
          },
          handshakeTimeout: 15000,
          maxPayload: 4 * 1024 * 1024,
          perMessageDeflate: false,
        },
      )
      let state: 'connection' | 'session' | 'ready' | 'finishing' | 'closed' =
        'connection'
      let opened = false
      let receivedAudio = false
      let timer: ReturnType<typeof setTimeout>
      const clean = () => {
        clearTimeout(timer)
        clearTimeout(lifetime)
        options.signal?.removeEventListener('abort', cancel)
        state = 'closed'
        // 此连接只承载一轮回复；终止后不保留供应商连接或残留音频。
        ws.terminate()
      }
      const fail = (cause: unknown) => {
        if (state === 'closed') return
        const error =
          cause instanceof AppError
            ? cause
            : new AppError(ErrorCodes.TTS_PROVIDER_FAILED, undefined, { cause })
        clean()
        if (opened) callbacks.onError(error)
        else reject(error)
      }
      const armTimeout = (ms: number) => {
        clearTimeout(timer)
        timer = setTimeout(() => fail(new AppError(ErrorCodes.TTS_TIMEOUT)), ms)
      }
      const send = (event: number, payload: unknown = {}, id?: string) => {
        if (ws.readyState !== WebSocket.OPEN || ws.bufferedAmount > 256 * 1024)
          throw new Error('TTS upstream unavailable or congested')
        ws.send(encodeTtsFrame(event, payload, id), (error) => {
          if (error) fail(error)
        })
      }
      const request = (event: number, text?: string) => ({
        event,
        req_params: {
          speaker: options.voice,
          audio_params: { format: 'pcm', sample_rate: 24000 },
          additions: JSON.stringify({
            disable_markdown_filter: true,
            disable_emoji_filter: true,
          }),
          ...(text === undefined ? {} : { text }),
        },
      })
      const cancel = () => {
        if (state === 'closed') return
        const wasOpened = opened
        clean()
        if (!wasOpened)
          reject(new DOMException('TTS session canceled', 'AbortError'))
      }
      const lifetime = setTimeout(
        () => fail(new AppError(ErrorCodes.TTS_TIMEOUT)),
        5 * 60_000,
      )
      const session: TtsSession = {
        sendText(text) {
          if (state !== 'ready')
            throw new AppError(
              ErrorCodes.TTS_PROVIDER_FAILED,
              '语音会话已结束输入',
            )
          if (!text) return
          try {
            send(
              TtsEvent.TaskRequest,
              request(TtsEvent.TaskRequest, text),
              sessionId,
            )
            armTimeout(60_000)
          } catch (error) {
            fail(error)
          }
        },
        finish() {
          if (state !== 'ready') return
          state = 'finishing'
          try {
            send(TtsEvent.FinishSession, {}, sessionId)
            armTimeout(60_000)
          } catch (error) {
            fail(error)
          }
        },
        cancel,
      }
      options.signal?.addEventListener('abort', cancel, { once: true })
      armTimeout(15000)
      ws.on('upgrade', (response) =>
        log.info(
          { logId: response.headers['x-tt-logid'] },
          'TTS WebSocket connected',
        ),
      )
      ws.on('unexpected-response', (_request, response) => {
        log.warn(
          {
            status: response.statusCode,
            logId: response.headers['x-tt-logid'],
          },
          'TTS handshake rejected',
        )
        response.resume()
        fail(new Error(`TTS handshake rejected: HTTP ${response.statusCode}`))
      })
      ws.on('open', () => {
        try {
          send(TtsEvent.StartConnection)
        } catch (error) {
          fail(error)
        }
      })
      ws.on('message', (data, binary) => {
        if (state === 'closed') return
        try {
          if (!binary) throw new Error('Expected binary TTS frame')
          const frame = decodeTtsFrame(
            Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer),
          )
          if (
            [TtsEvent.ConnectionFailed, TtsEvent.SessionFailed].includes(
              frame.event as 51 | 153,
            )
          ) {
            log.warn(
              { event: frame.event, detail: frame.payload.toString('utf8') },
              'TTS upstream rejected session',
            )
            throw new Error('TTS upstream rejected session')
          }
          if (frame.event >= 100 && frame.id !== sessionId)
            throw new Error('TTS session ID mismatch')
          if (
            frame.event === TtsEvent.ConnectionStarted &&
            state === 'connection'
          ) {
            state = 'session'
            send(
              TtsEvent.StartSession,
              request(TtsEvent.StartSession),
              sessionId,
            )
          } else if (
            frame.event === TtsEvent.SessionStarted &&
            state === 'session'
          ) {
            state = 'ready'
            opened = true
            armTimeout(60_000)
            resolve(session)
          } else if (frame.event === TtsEvent.Audio) {
            if (!opened || frame.type !== 11 || frame.payload.length % 2 !== 0)
              throw new Error('Invalid TTS PCM audio')
            if (frame.payload.length) {
              receivedAudio = true
              callbacks.onAudio(frame.payload)
            }
            if (ws.readyState === WebSocket.OPEN) armTimeout(60_000)
          } else if (frame.event === TtsEvent.SessionFinished) {
            if (state !== 'finishing' || !receivedAudio)
              throw new Error('Incomplete TTS session')
            clean()
            callbacks.onDone()
          } else if (
            [TtsEvent.ConnectionFinished, TtsEvent.SessionCanceled].includes(
              frame.event as 52 | 151,
            )
          ) {
            throw new Error('TTS session closed unexpectedly')
          }
        } catch (error) {
          fail(error)
        }
      })
      ws.on('error', fail)
      ws.on('close', () => {
        if (state !== 'closed')
          fail(new Error('TTS upstream closed before completion'))
      })
    })
  }
}
