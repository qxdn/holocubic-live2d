import { resolve } from 'node:path'
import * as ort from 'onnxruntime-node'
import { AppError } from '../../errors/app-error.ts'
import { ErrorCodes } from '../../errors/error-code.ts'
import type { SpeechVadConfig } from '../../../config/index.ts'

const FRAME_SAMPLES = 512
const CONTEXT_SAMPLES = 64
const STATE_SIZE = 2 * 128

let sessionPromise: Promise<ort.InferenceSession> | undefined
let modelPath: string | undefined

/** 保存 VAD 模型配置；路径相对于服务端进程工作目录解析。 */
export function initSileroVad(config: SpeechVadConfig): void {
  modelPath = resolve(config.modelPath)
}

/** 懒加载并复用进程级 ONNX 推理会话。 */
function getSession(): Promise<ort.InferenceSession> {
  if (!modelPath) {
    throw new AppError(
      ErrorCodes.SPEECH_PROVIDER_CONFIG_INVALID,
      'Silero VAD 模型路径尚未初始化',
    )
  }
  sessionPromise ??= ort.InferenceSession.create(modelPath)
  return sessionPromise
}

/** 提前加载共享模型，供 WebSocket 会话就绪前调用。 */
export async function warmUpSileroVad(): Promise<void> {
  await getSession()
}

/** 一条语音会话自己的 Silero 循环状态和跨帧音频上下文。 */
export type SileroVadState = {
  state: Float32Array
  context: Float32Array
}

/** 创建一条新语音会话使用的初始 VAD 状态。 */
export function createSileroVadState(): SileroVadState {
  return {
    state: new Float32Array(STATE_SIZE),
    context: new Float32Array(CONTEXT_SAMPLES),
  }
}

/**
 * 对一帧 16 kHz、单声道、PCM16LE 音频进行检测，并返回下一帧所需状态。
 * 函数不修改传入的状态；调用方负责保存返回状态，并按帧顺序串行调用。
 */
export async function runSileroVad(
  pcmFrame: Buffer,
  vadState: SileroVadState,
): Promise<{ probability: number; state: SileroVadState }> {
  if (pcmFrame.byteLength !== FRAME_SAMPLES * 2) {
    throw new AppError(
      ErrorCodes.ILLEGAL_PARAM,
      'Silero VAD 每帧需要 512 个 PCM16 采样点',
    )
  }

  const input = new Float32Array(FRAME_SAMPLES + CONTEXT_SAMPLES)
  input.set(vadState.context)
  for (let i = 0; i < FRAME_SAMPLES; i += 1) {
    input[CONTEXT_SAMPLES + i] = pcmFrame.readInt16LE(i * 2) / 32768
  }

  const session = await getSession()
  const results = await session.run({
    input: new ort.Tensor('float32', input, [1, input.length]),
    state: new ort.Tensor('float32', vadState.state, [2, 1, 128]),
    sr: new ort.Tensor('int64', BigInt64Array.of(16000n), [1]),
  })
  const output = results.output
  const nextState = results.stateN
  if (!output || !nextState) throw new Error('Invalid Silero VAD model outputs')

  return {
    probability: Number(output.data[0]),
    state: {
      state: Float32Array.from(nextState.data as Float32Array),
      // 当前帧的最后 64 个采样点作为下一帧的上下文。
      context: Float32Array.from(input.subarray(FRAME_SAMPLES)),
    },
  }
}

export const SILERO_VAD_FRAME_BYTES = FRAME_SAMPLES * 2
export const SILERO_VAD_FRAME_MS = (FRAME_SAMPLES / 16000) * 1000
