import { useEffect, useRef } from "react"

/** Plays the chat stream's 24 kHz PCM chunks in order without React state updates. */
export function useTts() {
  const context = useRef<AudioContext | null>(null)
  const sources = useRef(new Set<AudioBufferSourceNode>())
  const nextTime = useRef(0)

  const clean = () => {
    for (const source of sources.current) {
      source.onended = null
      source.stop()
      source.disconnect()
    }
    sources.current.clear()
    nextTime.current = 0
  }

  const prepare = async () => {
    clean()
    context.current ??= new AudioContext()
    await context.current.resume()
  }

  const play = (data: unknown) => {
    if (!context.current) return
    if (
      typeof data !== "object" ||
      data === null ||
      !("audio" in data) ||
      typeof data.audio !== "string" ||
      !("format" in data) ||
      data.format !== "pcm_s16le" ||
      !("sampleRate" in data) ||
      data.sampleRate !== 24000 ||
      !("channels" in data) ||
      data.channels !== 1
    )
      throw new Error("不支持的 TTS 音频格式")

    const raw = atob(data.audio)
    if (!raw.length) return
    if (raw.length % 2) throw new Error("TTS PCM 数据长度无效")
    const bytes = Uint8Array.from(raw, (char) => char.charCodeAt(0))
    const view = new DataView(bytes.buffer)
    const buffer = context.current.createBuffer(1, bytes.length / 2, 24000)
    const samples = buffer.getChannelData(0)
    for (let i = 0; i < samples.length; i++) {
      samples[i] = view.getInt16(i * 2, true) / 32768
    }
    const source = context.current.createBufferSource()
    source.buffer = buffer
    source.connect(context.current.destination)
    sources.current.add(source)
    source.onended = () => {
      sources.current.delete(source)
      source.disconnect()
    }
    const start = Math.max(context.current.currentTime + 0.03, nextTime.current)
    source.start(start)
    nextTime.current = start + buffer.duration
  }

  useEffect(
    () => () => {
      clean()
      void context.current?.close()
      context.current = null
    },
    []
  )

  return { prepare, play, clean }
}
