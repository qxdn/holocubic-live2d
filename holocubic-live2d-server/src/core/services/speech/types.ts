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

/** 音色由角色指定；取消信号由调用方传入。 */
export interface TtsOptions {
  readonly voice: string
  readonly signal?: AbortSignal
}

/** 每个会话对应一轮回复；finish 仅结束文本输入，仍继续接收音频。 */
export interface TtsSession {
  sendText(text: string): void
  finish(): void
  cancel(): void
}

/** 音频固定为 24 kHz、单声道 PCM S16LE；结束与错误只通知一次。 */
export interface TtsCallbacks {
  onAudio(data: Uint8Array): void
  onDone(): void
  onError(error: Error): void
}

export interface TtsProvider {
  openSession(options: TtsOptions, callbacks: TtsCallbacks): Promise<TtsSession>
}
