/** 一次识别的完整音频，PCM 为有符号 16-bit 小端采样。 */
export interface AsrAudio {
  readonly data: Uint8Array
  readonly format: 'pcm'
  readonly sampleRate: 16000
  readonly bits: 16
  readonly channels: 1
}

/** 识别语言由调用方从 Agent 配置中取得。 */
export interface AsrOptions {
  /** BCP 47 语言标签，例如 zh-CN、en-US。 */
  readonly language: string
}

/** 一次完整音频的最终识别结果。 */
export interface AsrResult {
  readonly text: string
}

/** 一次提交完整音频，等待最终结果；失败时 Promise 拒绝。 */
export interface AsrProvider {
  transcribe(audio: AsrAudio, options: AsrOptions): Promise<AsrResult>
}
