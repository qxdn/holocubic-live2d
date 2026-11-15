import { gunzipSync } from 'node:zlib'
import { AppError, ErrorCodes } from '../../../errors/index.ts'

/** 火山双向 TTS 二进制事件编号，仅供供应商适配器使用。 */
export const TtsEvent = {
  StartConnection: 1,
  FinishConnection: 2,
  ConnectionStarted: 50,
  ConnectionFailed: 51,
  ConnectionFinished: 52,
  StartSession: 100,
  CancelSession: 101,
  FinishSession: 102,
  SessionStarted: 150,
  SessionCanceled: 151,
  SessionFinished: 152,
  SessionFailed: 153,
  TaskRequest: 200,
  Audio: 352,
} as const

/** 客户端请求：4 字节头、事件、可选会话 ID、JSON 负载。 */
export function encodeTtsFrame(
  event: number,
  payload: unknown,
  sessionId?: string,
): Buffer {
  const body = Buffer.from(JSON.stringify(payload))
  const id = sessionId === undefined ? undefined : Buffer.from(sessionId)
  const frame = Buffer.alloc(12 + body.length + (id ? 4 + id.length : 0))
  frame.set([0x11, 0x14, 0x10, 0])
  frame.writeUInt32BE(event, 4)
  let offset = 8
  if (id) {
    frame.writeUInt32BE(id.length, offset)
    id.copy(frame, offset + 4)
    offset += 4 + id.length
  }
  frame.writeUInt32BE(body.length, offset)
  body.copy(frame, offset + 4)
  return frame
}

/** 解析服务端事件；拒绝截断、越界和未支持的帧头。 */
export function decodeTtsFrame(frame: Buffer): {
  type: number
  event: number
  id: string
  payload: Buffer
} {
  if (frame.length < 4 || frame[0] >> 4 !== 1)
    throw new AppError(ErrorCodes.TTS_PROVIDER_FAILED, '语音合成响应头无效')
  const type = frame[1] >> 4
  const flags = frame[1] & 15
  const compression = frame[2] & 15
  let offset = (frame[0] & 15) * 4
  if (offset < 4 || offset > frame.length || ![0, 1].includes(compression))
    throw new AppError(ErrorCodes.TTS_PROVIDER_FAILED, '语音合成响应头无效')
  const uint32 = () => {
    if (offset + 4 > frame.length)
      throw new AppError(ErrorCodes.TTS_PROVIDER_FAILED, '语音合成响应帧不完整')
    const value = frame.readUInt32BE(offset)
    offset += 4
    return value
  }
  const bytes = () => {
    const length = uint32()
    if (offset + length > frame.length)
      throw new AppError(
        ErrorCodes.TTS_PROVIDER_FAILED,
        '语音合成响应数据不完整',
      )
    const value = frame.subarray(offset, offset + length)
    offset += length
    return value
  }
  let event = 0
  let id = ''
  let errorCode = 0
  if (type === 15) errorCode = uint32()
  else {
    if (![9, 11].includes(type) || flags !== 4)
      throw new AppError(
        ErrorCodes.TTS_PROVIDER_FAILED,
        '不支持的语音合成响应帧',
      )
    event = uint32()
    id = bytes().toString('utf8') // 连接事件携带 connect ID，其余事件携带 session ID。
  }
  let payload = bytes()
  if (offset !== frame.length)
    throw new AppError(
      ErrorCodes.TTS_PROVIDER_FAILED,
      '语音合成响应包含多余数据',
    )
  if (compression === 1) {
    try {
      payload = gunzipSync(payload, { maxOutputLength: 4 * 1024 * 1024 })
    } catch (cause) {
      throw new AppError(
        ErrorCodes.TTS_PROVIDER_FAILED,
        '语音合成响应解压失败',
        { cause },
      )
    }
  }
  if (type === 15)
    throw new AppError(ErrorCodes.TTS_PROVIDER_FAILED, undefined, {
      cause: new Error(`TTS error ${errorCode}: ${payload.toString('utf8')}`),
    })
  return { type, event, id, payload }
}
