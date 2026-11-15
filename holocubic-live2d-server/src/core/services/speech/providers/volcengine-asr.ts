import { randomUUID } from 'node:crypto'
import { gzipSync, gunzipSync } from 'node:zlib'
import WebSocket from 'ws'
import { z } from 'zod'
import { AppError, ErrorCodes } from '../../../errors/index.ts'
import { logger } from '../../../logger/index.ts'
import type { AsrAudio, AsrOptions, AsrProvider, AsrResult } from '../types.ts'

export interface VolcengineAsrOptions {
  /** 豆包语音新版控制台 API Key，仅保存在服务端。 */
  readonly apiKey: string
  readonly resourceId?: string
  readonly endpoint?: string
}

const resultSchema = z.looseObject({
  audio_info: z.looseObject({ duration: z.number().optional() }).optional(),
  result: z
    .looseObject({
      text: z.string().optional(),
      additions: z.looseObject({ log_id: z.string().optional() }).optional(),
      utterances: z
        .array(
          z.looseObject({
            text: z.string(),
            start_time: z.number(),
            end_time: z.number(),
            definite: z.boolean(),
            words: z
              .array(
                z.looseObject({
                  text: z.string(),
                  start_time: z.number(),
                  end_time: z.number(),
                  blank_duration: z.number().optional(),
                }),
              )
              .optional(),
          }),
        )
        .optional(),
    })
    .optional(),
})

enum MessageType {
  FullClientRequest = 1,
  AudioOnlyRequest = 2,
}

enum MessageFlags {
  WithSequence = 1,
  LastWithSequence = 3,
}

enum Serialization {
  None = 0,
  Json = 1,
}

/**
 * 编码带序号的火山 WebSocket 请求帧，负载统一使用 gzip 压缩。
 * @see https://docs.volcengine.com/docs/doubao-voice/large-model-streaming-automatic-speech-recognition-api-1?lang=zh
 * @param type 消息类型：1 为音频配置请求，2 为音频数据请求，占协议头第二字节的高 4 位。
 * @param flags 消息标志：1 表示携带序号，3 表示携带序号且为最后一包，占第二字节的低 4 位。
 * @param sequence 请求序号，从 1 递增；最后一包取对应序号的负值，以 4 字节大端有符号整数写入。
 * @param serialization 序列化标志：配置请求为 JSON，裸 PCM 音频请求为 None。
 * @param data 待压缩的负载字节：配置请求传入 UTF-8 JSON，音频请求传入当前分包的裸 PCM。
 */
function encodeFrame(
  type: MessageType,
  flags: MessageFlags,
  sequence: number,
  serialization: Serialization,
  data: Uint8Array,
): Buffer {
  const payload = gzipSync(data)
  const size = Buffer.alloc(4)
  const seq = Buffer.alloc(4)
  seq.writeInt32BE(sequence)
  size.writeUInt32BE(payload.length)
  return Buffer.concat([
    Buffer.from([0x11, (type << 4) | flags, (serialization << 4) | 0x01, 0]),
    seq,
    size,
    payload,
  ])
}

/** 二进制协议头，headerSize 单位为字节，extensions 保留扩展头原始字节。 */
type FrameHeader = {
  version: number
  headerSize: number
  messageType: number
  flags: number
  serialization: number
  compression: number
  reserved: number
  extensions: Buffer
}

/** 按二进制文档保留帧层级；长度字段记录线上压缩负载的字节数。 */
type DecodedFrame =
  | {
      type: 'error'
      header: FrameHeader
      errorCode: number
      errorMessageSize: number
      errorMessage: string
    }
  | {
      type: 'result'
      header: FrameHeader
      sequence?: number
      payloadSize: number
      payload: z.infer<typeof resultSchema>
    }

/**
 * 解码火山响应帧：校验协议头和长度、解压负载，并区分识别结果与厂商错误。
 * @param data ws 接收到的原始消息字节。
 * @param isBinary 消息是否为二进制帧，文本消息不符合火山协议。
 * @returns 保留 Header、Sequence、Payload size、Payload 的结果帧，或独立的错误帧。
 * @see https://docs.volcengine.com/docs/doubao-voice/large-model-streaming-automatic-speech-recognition-api-1?lang=zh
 */
function decodeFrame(data: WebSocket.RawData, isBinary: boolean): DecodedFrame {
  if (!isBinary)
    throw new AppError(ErrorCodes.SPEECH_PROTOCOL_INVALID, '预期火山二进制响应')
  const frame = Array.isArray(data)
    ? Buffer.concat(data)
    : Buffer.isBuffer(data)
      ? data
      : Buffer.from(data)
  if (frame.length < 8 || frame[0] >> 4 !== 1)
    throw new AppError(ErrorCodes.SPEECH_PROTOCOL_INVALID, '无效的火山协议头')
  const type = frame[1] >> 4
  const flags = frame[1] & 15
  const compression = frame[2] & 15
  let offset = (frame[0] & 15) * 4
  if (offset < 4 || offset > frame.length - 4)
    throw new AppError(
      ErrorCodes.SPEECH_PROTOCOL_INVALID,
      '无效的火山协议头长度',
    )
  const header: FrameHeader = {
    version: frame[0] >> 4,
    headerSize: offset,
    messageType: type,
    flags,
    serialization: frame[2] >> 4,
    compression,
    reserved: frame[3],
    extensions: frame.subarray(4, offset),
  }
  // 本文档仅定义 flags 0~3，不引入 Python 示例额外的 event 字段。
  if (flags > 3)
    throw new AppError(ErrorCodes.SPEECH_PROTOCOL_INVALID, '未知火山消息标志')
  let sequence: number | undefined
  let errorCode = 0
  if (type === 15) {
    if (offset + 8 > frame.length)
      throw new AppError(
        ErrorCodes.SPEECH_PROTOCOL_INVALID,
        '火山错误帧长度不足',
      )
    errorCode = frame.readUInt32BE(offset)
    offset += 4
  } else if (type === 9) {
    if (flags & 1) {
      if (offset + 8 > frame.length)
        throw new AppError(
          ErrorCodes.SPEECH_PROTOCOL_INVALID,
          '火山响应序号或长度缺失',
        )
      sequence = frame.readInt32BE(offset)
      offset += 4
    }
  } else
    throw new AppError(
      ErrorCodes.SPEECH_PROTOCOL_INVALID,
      `未知火山消息类型 ${type}`,
    )
  const size = frame.readUInt32BE(offset)
  offset += 4
  if (offset + size !== frame.length)
    throw new AppError(
      ErrorCodes.SPEECH_PROTOCOL_INVALID,
      '火山响应负载长度不匹配',
    )
  let payload: Buffer = frame.subarray(offset)
  if (compression === 1) payload = gunzipSync(payload)
  else if (compression !== 0)
    throw new AppError(ErrorCodes.SPEECH_PROTOCOL_INVALID, '未知火山压缩方式')

  if (type === 15)
    return {
      type: 'error',
      header,
      errorCode,
      errorMessageSize: size,
      errorMessage: payload.toString('utf8'),
    }
  if (frame[2] >> 4 !== 1)
    throw new AppError(ErrorCodes.SPEECH_PROTOCOL_INVALID, '预期 JSON 识别结果')
  const body: unknown = payload.length
    ? JSON.parse(payload.toString('utf8'))
    : {}
  return {
    type: 'result',
    header,
    sequence,
    payloadSize: size,
    payload: resultSchema.parse(body),
  }
}

/** 一句话识别：内部通过 WebSocket 发送音频，对调用方返回最终文本。
 * @see https://docs.volcengine.com/docs/doubao-voice/unidirectional-streaming-automatic-speech-recognition-websocket?lang=zh
 * @see https://docs.volcengine.com/docs/doubao-voice/large-model-streaming-automatic-speech-recognition-api-1?lang=zh
 */
export class VolcengineAsrProvider implements AsrProvider {
  constructor(private readonly options: VolcengineAsrOptions) {
    if (!options.apiKey.trim())
      throw new AppError(ErrorCodes.ILLEGAL_PARAM, '火山引擎 API Key 不能为空')
    if (
      options.endpoint &&
      !['wss:', 'ws:'].includes(new URL(options.endpoint).protocol)
    )
      throw new AppError(
        ErrorCodes.ILLEGAL_PARAM,
        '一句话识别需要 WebSocket 地址',
      )
  }

  // -------------------- 对外方法 --------------------
  async transcribe(audio: AsrAudio, options: AsrOptions): Promise<AsrResult> {
    this.check(audio, options)
    return new Promise<AsrResult>((resolve, reject) => {
      const requestId = randomUUID()
      const resourceId = this.options.resourceId ?? 'volc.seedasr.sauc.duration'
      const startedAt = Date.now()
      const speechLogger = logger.child({
        provider: 'volcengine',
        requestId,
        resourceId,
      })
      const socket = new WebSocket(
        this.options.endpoint ??
          'wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_nostream',
        {
          headers: {
            'X-Api-Key': this.options.apiKey,
            'X-Api-Resource-Id': resourceId,
            'X-Api-Request-Id': requestId,
          },
        },
      )
      let settled = false
      let initialized = false
      // 握手响应头返回的火山请求标识，用于供应商侧排查。
      let logId = ''
      let sendTimer: ReturnType<typeof setTimeout> | undefined
      const timeout = setTimeout(
        () =>
          finish(
            new AppError(ErrorCodes.SPEECH_TIMEOUT, undefined, {
              retryable: true,
            }),
          ),
        60_000,
      )
      const finish = (error?: unknown, text = '') => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        clearTimeout(sendTimer)
        if (socket.readyState === WebSocket.OPEN) socket.close()
        else if (socket.readyState === WebSocket.CONNECTING) socket.terminate()
        if (error)
          reject(
            error instanceof AppError
              ? error
              : new AppError(ErrorCodes.SPEECH_PROVIDER_FAILED, undefined, {
                  cause: error,
                }),
          )
        else {
          speechLogger.info(
            { logId, text, elapsedMs: Date.now() - startedAt },
            'ASR transcription completed',
          )
          resolve({ text })
        }
      }
      socket.on('upgrade', (response) => {
        logId = response.headers['x-tt-logid']?.toString() ?? ''
        speechLogger.info(
          { logId, elapsedMs: Date.now() - startedAt },
          'ASR WebSocket connected',
        )
      })
      socket.on('unexpected-response', (_request, response) => {
        logId = response.headers['x-tt-logid']?.toString() ?? ''
        const providerStatus =
          response.headers['x-api-status-code']?.toString() ?? ''
        const providerMessage =
          response.headers['x-api-message']?.toString() ?? ''
        // 仅记录失败响应体，最多 8 KiB；不记录鉴权请求头或音频内容。
        const chunks: Buffer[] = []
        let bodyBytes = 0
        const reportFailure = (cause?: Error) => {
          if (settled) return
          const responseBody = Buffer.concat(chunks).toString('utf8')
          speechLogger.error(
            {
              logId,
              httpStatus: response.statusCode,
              providerStatus,
              providerMessage,
              responseBody,
              responseBodyTruncated: bodyBytes > 8192,
              elapsedMs: Date.now() - startedAt,
              err: cause,
            },
            'ASR WebSocket handshake rejected',
          )
          finish(
            new AppError(
              ErrorCodes.SPEECH_PROVIDER_FAILED,
              `火山引擎连接失败（HTTP ${response.statusCode}，状态 ${providerStatus}，${providerMessage}，Log ID ${logId}）`,
              {
                cause,
                retryable:
                  response.statusCode === 429 ||
                  (response.statusCode ?? 0) >= 500,
              },
            ),
          )
        }
        response.on('data', (chunk: Buffer) => {
          if (bodyBytes < 8192) chunks.push(chunk.subarray(0, 8192 - bodyBytes))
          bodyBytes += chunk.length
        })
        response.once('end', () => reportFailure())
        response.once('error', (error) => reportFailure(error))
        response.once('aborted', () =>
          reportFailure(new Error('火山握手失败响应读取中断')),
        )
      })
      socket.on('error', (error) => finish(error))
      socket.on('close', () => {
        if (!settled)
          finish(
            new AppError(
              ErrorCodes.SPEECH_PROVIDER_FAILED,
              `火山引擎在返回最终结果前断开连接（Log ID ${logId}）`,
              { retryable: true },
            ),
          )
      })
      let audioOffset = 0
      let sequence = 2
      // 初始化成功后才开始发送，200 ms PCM16 = 6400 字节。
      const sendNext = () => {
        if (settled || socket.readyState !== WebSocket.OPEN) return
        const end = Math.min(audioOffset + 6400, audio.data.byteLength)
        const last = end === audio.data.byteLength
        const frame = encodeFrame(
          MessageType.AudioOnlyRequest,
          last ? MessageFlags.LastWithSequence : MessageFlags.WithSequence,
          last ? -sequence : sequence,
          Serialization.None,
          audio.data.subarray(audioOffset, end),
        )
        audioOffset = end
        sequence += 1
        socket.send(frame, (error) => {
          if (error) {
            finish(error)
            return
          }
          if (!last && !settled) sendTimer = setTimeout(sendNext, 200)
        })
      }
      socket.on('open', () => {
        socket.send(
          encodeFrame(
            MessageType.FullClientRequest,
            MessageFlags.WithSequence,
            1,
            Serialization.Json,
            Buffer.from(
              JSON.stringify({
                user: { uid: 'holocubic-live2d' },
                audio: {
                  format: 'pcm',
                  codec: 'raw',
                  rate: 16000,
                  bits: 16,
                  channel: 1,
                  language: options.language,
                },
                request: { model_name: 'bigmodel', result_type: 'full' },
              }),
            ),
          ),
          (error) => {
            if (error) finish(error)
          },
        )
      })
      socket.on('message', (data, isBinary) => {
        if (settled) return
        try {
          const decoded = decodeFrame(data, isBinary)
          // 错误帧按协议携带 UTF-8 错误描述，不能强制当作 JSON。
          if (decoded.type === 'error') {
            if (decoded.errorCode === 20000003) {
              finish(undefined, '')
              return
            }
            throw new AppError(
              ErrorCodes.SPEECH_PROVIDER_FAILED,
              `火山引擎识别失败（状态 ${decoded.errorCode}，${decoded.errorMessage}，Log ID ${logId}）`,
              { retryable: String(decoded.errorCode).startsWith('550') },
            )
          }
          if (decoded.header.flags & 2) {
            const text = decoded.payload.result?.text
            if (text === undefined) throw new Error('最终识别结果缺少 text')
            finish(undefined, text)
          } else if (!initialized) {
            initialized = true
            sendNext()
          }
        } catch (error) {
          finish(error)
        }
      })
    })
  }

  // -------------------- 私有方法 --------------------
  private check(audio: AsrAudio, options: AsrOptions): void {
    if (
      audio.format !== 'pcm' ||
      audio.sampleRate !== 16000 ||
      audio.bits !== 16 ||
      audio.channels !== 1 ||
      !audio.data.byteLength ||
      audio.data.byteLength % 2 !== 0 ||
      !options.language.trim()
    )
      throw new AppError(
        ErrorCodes.ILLEGAL_PARAM,
        '需要非空的 16 kHz 单声道 PCM16 音频和识别语言',
      )
  }
}
