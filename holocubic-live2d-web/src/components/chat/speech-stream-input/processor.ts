// TypeScript's DOM library does not include the AudioWorklet processor scope.
declare class AudioWorkletProcessor {
  readonly port: MessagePort
}
declare function registerProcessor(
  name: string,
  processor: typeof PcmProcessor
): void

// AudioContext runs at 16 kHz; batch samples into 32 ms PCM frames for VAD.
class PcmProcessor extends AudioWorkletProcessor {
  private samples: ArrayBuffer
  private view: DataView
  private offset: number

  constructor() {
    super()
    this.samples = new ArrayBuffer(1024)
    this.view = new DataView(this.samples)
    this.offset = 0
  }

  process(inputs: Float32Array[][]): boolean {
    const audio = inputs[0]?.[0]
    if (!audio) return true
    for (const value of audio) {
      const sample = Math.max(-1, Math.min(1, value))
      this.view.setInt16(
        this.offset * 2,
        Math.round(sample * (sample < 0 ? 32768 : 32767)),
        true
      )
      if (++this.offset === 512) {
        this.port.postMessage(this.samples, [this.samples])
        this.samples = new ArrayBuffer(1024)
        this.view = new DataView(this.samples)
        this.offset = 0
      }
    }
    return true
  }
}

registerProcessor("speech-pcm", PcmProcessor)
