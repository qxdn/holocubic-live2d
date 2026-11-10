import { upgradeWebSocket } from '@hono/node-server'
import WebSocket from 'ws'
import { AppError } from '../core/errors/app-error.ts'
import { ErrorCodes } from '../core/errors/error-code.ts'
import { getCharacter } from '../core/character/registry.ts'
import { providerFactory } from '../core/services/speech/index.ts'
import type { AsrAudio } from '../core/services/speech/types.ts'
import {
  createSileroVadState,
  runSileroVad,
  SILERO_VAD_FRAME_BYTES,
  SILERO_VAD_FRAME_MS,
  warmUpSileroVad,
} from '../core/services/speech/silero-vad.ts'
import { logger } from '../core/logger/index.ts'

type SpeechSocket = {
  readyState: number
  send(data: string): void
  close(code?: number, reason?: string): void
}

const PRE_ROLL_MS = 200 // 检测到语音后，额外保留起点前的音频，避免截掉字头。
const END_SILENCE_MS = 700 // 语音概率低于结束阈值并持续此时长后，提交当前语句。
const MIN_SPEECH_MS = 250 // 有效语音短于此时长时丢弃，过滤瞬时噪声。
const MAX_SPEECH_MS = 5 * 60 * 1000 // 单句最长 5 分钟，避免长时间不静音导致缓存无限增长。
const START_THRESHOLD = 0.5 // VAD 概率达到此值时开始一条语音。
const END_THRESHOLD = 0.35 // 低于此值才累计静音；比起始阈值低，减少语音边缘抖动。
const RESET_SILENCE_THRESHOLD = 0.1 // 空闲时低于此概率的帧计入模型状态重置静音。
const RESET_IDLE_MS = 2000 // 空闲静音累计到此时长后重置 VAD 循环状态。
const MAX_PENDING_TRANSCRIPTIONS = 2 // ASR 同时处理上限；超过时丢弃新完成的语句。

/** 将 Hono WebSocket 事件中的消息数据统一转换为 Buffer。 */
function toBuffer(data: unknown): Buffer {
  // 文本帧用于控制消息，按 UTF-8 编码后交给统一解析逻辑。
  if (typeof data === 'string') return Buffer.from(data)
  // 二进制帧在 WebSocket API 中通常以 ArrayBuffer 表示。
  if (data instanceof ArrayBuffer) return Buffer.from(data)
  // 视图可能只占底层 buffer 的一段，需保留 byteOffset 和 byteLength。
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength)
  }
  throw new AppError(
    ErrorCodes.SPEECH_PROTOCOL_INVALID,
    '不支持的 WebSocket 消息数据类型',
  )
}

export const speechStreamHandler = upgradeWebSocket((c) => {
  const characterId = c.req.query('characterId')
  if (!characterId) {
    throw new AppError(ErrorCodes.ILLEGAL_PARAM, '缺少查询参数 characterId')
  }

  const character = getCharacter(characterId)
  const asrOptions = character.speech?.asr
  if (!asrOptions) throw new AppError(ErrorCodes.AGENT_ASR_NOT_CONFIGURED)
  const provider = providerFactory(asrOptions.provider)

  // 每个连接独立维护 VAD 循环状态、上下文、音频缓存和消息处理队列。
  let vadState = createSileroVadState()
  let closed = false
  // 保存消息队列尾部的 Promise；VAD 推理是异步的，必须按收到顺序处理消息。
  let processing = Promise.resolve()
  // 暂存不足一帧的音频字节，凑满 512 个采样点后再送入 VAD。
  let pendingBytes: Buffer = Buffer.alloc(0)
  // 前置音频环形缓存，以及当前正在识别的语句缓存。
  let preRoll: Buffer[] = []
  let preRollBytes = 0
  let utterance: Buffer[] = []
  let utteranceBytes = 0
  // 当前语音段的断句计时与 ASR 并发计数。
  let active = false
  let silenceMs = 0
  let speechMs = 0
  let voicedMs = 0
  let idleMs = 0
  let pendingTranscriptions = 0

  const sendJson = (ws: SpeechSocket, message: Record<string, unknown>) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message))
  }

  const sendError = (ws: SpeechSocket, code: string, message: string) => {
    sendJson(ws, {
      code,
      traceId: crypto.randomUUID().replaceAll('-', ''),
      success: false,
      message,
      total: 0,
      data: null,
    })
  }

  /** 结束当前语句并重置 VAD 状态，为下一句话做准备。 */
  const resetUtterance = () => {
    active = false
    silenceMs = 0
    speechMs = 0
    voicedMs = 0
    utterance = []
    utteranceBytes = 0
    vadState = createSileroVadState()
  }

  /** 将 VAD 切出的整句交给角色配置的 ASR provider。 */
  const transcribe = (audio: Buffer, durationMs: number, ws: SpeechSocket) => {
    if (durationMs < MIN_SPEECH_MS) return
    if (pendingTranscriptions >= MAX_PENDING_TRANSCRIPTIONS) {
      sendError(ws, ErrorCodes.SPEECH_QUEUE_FULL.code, '语音识别队列已满')
      return
    }
    pendingTranscriptions += 1
    const pcm: AsrAudio = {
      data: new Uint8Array(audio.buffer, audio.byteOffset, audio.byteLength),
      format: 'pcm',
      sampleRate: 16000,
      bits: 16,
      channels: 1,
    }
    void provider
      .transcribe(pcm, { language: asrOptions.language })
      .then(({ text }) => sendJson(ws, { type: 'transcript', text }))
      .catch((error: unknown) => {
        logger.warn(
          { err: error, characterId },
          'Speech stream transcription failed',
        )
        sendError(ws, ErrorCodes.SPEECH_PROVIDER_FAILED.code, '语音识别失败')
      })
      .finally(() => {
        pendingTranscriptions -= 1
      })
  }

  /** 固定当前语句音频后异步识别，不阻塞后续 VAD 帧处理。 */
  const finishUtterance = (ws: SpeechSocket) => {
    const audio = Buffer.concat(utterance, utteranceBytes)
    const durationMs = voicedMs
    resetUtterance()
    transcribe(audio, durationMs, ws)
  }

  /** 维护语音起点前的短缓存，触发时拼回语句开头。 */
  const addPreRoll = (frame: Buffer) => {
    preRoll.push(frame)
    preRollBytes += frame.byteLength
    const maxBytes = Math.ceil(
      (PRE_ROLL_MS / SILERO_VAD_FRAME_MS) * SILERO_VAD_FRAME_BYTES,
    )
    while (preRollBytes > maxBytes && preRoll.length > 1) {
      preRollBytes -= preRoll.shift()!.byteLength
    }
  }

  /** 运行一帧 VAD，并按起始阈值、静音时长和句长上限管理语句。 */
  const processFrame = async (frame: Buffer, ws: SpeechSocket) => {
    const result = await runSileroVad(frame, vadState)
    vadState = result.state
    const probability = result.probability
    if (!active) {
      addPreRoll(frame)
      idleMs =
        probability < RESET_SILENCE_THRESHOLD ? idleMs + SILERO_VAD_FRAME_MS : 0
      if (idleMs >= RESET_IDLE_MS) {
        vadState = createSileroVadState()
        idleMs = 0
      }
      if (probability >= START_THRESHOLD) {
        active = true
        utterance = [...preRoll]
        utteranceBytes = preRollBytes
        speechMs = preRollBytes / (SILERO_VAD_FRAME_BYTES / SILERO_VAD_FRAME_MS)
        voicedMs = SILERO_VAD_FRAME_MS
        silenceMs = 0
        preRoll = []
        preRollBytes = 0
      }
      return
    }

    utterance.push(frame)
    utteranceBytes += frame.byteLength
    speechMs += SILERO_VAD_FRAME_MS
    if (probability >= END_THRESHOLD) voicedMs += SILERO_VAD_FRAME_MS
    silenceMs =
      probability < END_THRESHOLD ? silenceMs + SILERO_VAD_FRAME_MS : 0
    if (silenceMs >= END_SILENCE_MS || speechMs >= MAX_SPEECH_MS) {
      finishUtterance(ws)
    }
  }

  /** 文本帧承载控制消息；二进制帧承载连续 PCM 音频。 */
  const processMessage = async (data: unknown, ws: SpeechSocket) => {
    if (typeof data === 'string') {
      let message: { type?: string }
      try {
        message = JSON.parse(data) as { type?: string }
      } catch {
        sendError(ws, ErrorCodes.SPEECH_PROTOCOL_INVALID.code, '无效的控制消息')
        return
      }
      if (message.type === 'stop' && active) finishUtterance(ws)
      if (message.type === 'ping') sendJson(ws, { type: 'pong' })
      return
    }

    const chunk = toBuffer(data)
    if (chunk.byteLength === 0) return
    pendingBytes = pendingBytes.length
      ? Buffer.concat([pendingBytes, chunk])
      : chunk
    while (pendingBytes.byteLength >= SILERO_VAD_FRAME_BYTES) {
      const frame = pendingBytes.subarray(0, SILERO_VAD_FRAME_BYTES)
      pendingBytes = pendingBytes.subarray(SILERO_VAD_FRAME_BYTES)
      await processFrame(frame, ws)
      if (closed) return
    }
  }

  return {
    onOpen(_event, ws) {
      // 模型初始化完成后再通知客户端开始发送音频。
      void warmUpSileroVad()
        .then(() =>
          sendJson(ws, {
            type: 'ready',
            sampleRate: 16000,
            format: 'pcm_s16le',
          }),
        )
        .catch((error: unknown) => {
          logger.error({ err: error }, 'Failed to initialize local Silero VAD')
          sendError(
            ws,
            ErrorCodes.SPEECH_PROVIDER_CONFIG_INVALID.code,
            '服务端 VAD 初始化失败',
          )
          ws.close(1011, 'VAD initialization failed')
        })
    },
    onMessage(event, ws) {
      // 将当前消息接到队尾并更新队列尾部，避免异步 VAD 推理导致帧乱序。
      processing = processing
        .then(() => processMessage(event.data, ws))
        .catch((error: unknown) => {
          logger.error(
            { err: error, characterId },
            'Speech stream processing failed',
          )
          sendError(ws, ErrorCodes.SPEECH_PROTOCOL_INVALID.code, '语音流处理失败')
          ws.close(1011, 'speech processing failed')
        })
    },
    onClose() {
      // 连接结束后释放尚未组成完整帧或语句的缓存。
      closed = true
      pendingBytes = Buffer.alloc(0)
      resetUtterance()
    },
    onError(event, ws) {
      // 发生传输错误时关闭当前会话。
      logger.warn(
        { eventType: event.type, characterId },
        'Speech WebSocket error',
      )
      ws.close(1011, 'speech WebSocket error')
    },
  }
})
