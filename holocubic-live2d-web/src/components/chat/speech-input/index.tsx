import { useEffect, useRef, useState } from "react"
import { LoaderCircleIcon, MicIcon, SquareIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { request } from "@/api/request"

type SpeechInputProps = {
  characterId: string
  disabled: boolean
  onTranscript: (text: string) => void
}

// Decode the browser's recording, then let Web Audio downmix and resample it.
async function toPcm(blob: Blob): Promise<ArrayBuffer> {
  const context = new AudioContext()
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer())
    const offline = new OfflineAudioContext(
      1,
      Math.max(1, Math.ceil(decoded.duration * 16000)),
      16000
    )
    const source = offline.createBufferSource()
    source.buffer = decoded
    source.connect(offline.destination)
    source.start()
    const audio = (await offline.startRendering()).getChannelData(0)
    const pcm = new ArrayBuffer(audio.length * 2)
    const view = new DataView(pcm)
    for (let i = 0; i < audio.length; i++) {
      const sample = Math.max(-1, Math.min(1, audio[i]))
      view.setInt16(
        i * 2,
        Math.round(sample * (sample < 0 ? 32768 : 32767)),
        true
      )
    }
    return pcm
  } finally {
    await context.close()
  }
}

/** Records one utterance and fills the input after backend ASR completes. */
export const SpeechInput = ({
  characterId,
  disabled,
  onTranscript,
}: SpeechInputProps) => {
  const [phase, setPhase] = useState<
    "idle" | "starting" | "recording" | "recognizing"
  >("idle")
  const recorder = useRef<MediaRecorder | null>(null)
  const controller = useRef<AbortController | null>(null)

  const clean = () => {
    controller.current?.abort()
    const recording = recorder.current
    if (!recording) return
    recording.onstop = null
    recording.onerror = null
    if (recording.state === "recording") recording.stop()
    recording.stream.getTracks().forEach((track) => track.stop())
  }

  useEffect(() => {
    // 挂载时注册清理函数，卸载时由 React 调用。
    return clean
  }, [])

  // 将录音事件转成 Promise，让停止、错误和取消回到同一条异步流程。
  const record = async (recording: MediaRecorder, signal: AbortSignal) => {
    const chunks: Blob[] = []
    let cancel: () => void = () => {}
    try {
      return await new Promise<Blob>((resolve, reject) => {
        cancel = () => reject(signal.reason)
        signal.addEventListener("abort", cancel, { once: true })
        recording.ondataavailable = ({ data }) => {
          if (data.size) chunks.push(data)
        }
        recording.onerror = () => reject(new Error("录音失败，请重试"))
        recording.onstop = () =>
          resolve(new Blob(chunks, { type: recording.mimeType }))
        recording.start()
        setPhase("recording")
      })
    } finally {
      signal.removeEventListener("abort", cancel)
      recording.ondataavailable = null
      recording.onerror = null
      recording.onstop = null
      if (recording.state === "recording") recording.stop()
      recording.stream.getTracks().forEach((track) => track.stop())
    }
  }

  const start = async () => {
    if (phase !== "idle") return
    const { signal } = (controller.current = new AbortController())
    setPhase("starting")
    let media: MediaStream | undefined
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      ) {
        throw new Error(
          "当前浏览器无法录音，请使用 HTTPS 或 localhost 并允许麦克风权限"
        )
      }
      media = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1 },
        video: false,
      })
      // 权限申请可能在卸载后才完成；抛出后由 finally 释放麦克风。
      signal.throwIfAborted()
      const recording = new MediaRecorder(media)
      recorder.current = recording
      const blob = await record(recording, signal)
      signal.throwIfAborted()
      setPhase("recognizing")
      const pcm = await toPcm(blob)
      signal.throwIfAborted()
      const result = await request<{ text: string }>(
        `/api/speech/asr?characterId=${encodeURIComponent(characterId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: pcm,
          signal,
        }
      )
      signal.throwIfAborted()
      const text = result.text.trim()
      if (text) onTranscript(text)
      else toast.error("未识别到语音，请重试")
    } catch (cause) {
      if (!signal.aborted) {
        toast.error(cause instanceof Error ? cause.message : "语音输入失败")
      }
    } finally {
      media?.getTracks().forEach((track) => track.stop())
      if (!signal.aborted) setPhase("idle")
    }
  }

  const processing = phase === "starting" || phase === "recognizing"

  return (
    <Button
      type="button"
      size="icon-sm"
      variant={phase === "recording" ? "destructive" : "ghost"}
      disabled={processing || (disabled && phase !== "recording")}
      aria-busy={processing}
      onClick={() =>
        phase === "recording" ? recorder.current?.stop() : void start()
      }
    >
      {processing ? (
        <LoaderCircleIcon className="size-4 animate-spin" />
      ) : phase === "recording" ? (
        <SquareIcon className="size-4" />
      ) : (
        <MicIcon className="size-4" />
      )}
    </Button>
  )
}
