import { useEffect, useRef, useState } from "react"
import { LoaderCircleIcon, MicIcon, SquareIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import processorUrl from "./processor.ts?worker&url"

type Props = {
  characterId: string
  disabled: boolean
  onTranscript: (text: string) => void
}

/** Streams microphone PCM to backend VAD and appends each recognized utterance. */
export const SpeechStreamInput = ({
  characterId,
  disabled,
  onTranscript,
}: Props) => {
  const [phase, setPhase] = useState<"idle" | "starting" | "recording">("idle")
  const session = useRef<AbortController | null>(null)
  const stopCapture = useRef<() => void>(() => {})
  const socket = useRef<WebSocket | null>(null)
  // Socket callbacks must append to the latest input after each render.
  const transcript = useRef(onTranscript)
  useEffect(() => {
    transcript.current = onTranscript
  }, [onTranscript])

  useEffect(
    () => () => {
      session.current?.abort()
    },
    []
  )

  const start = async () => {
    session.current?.abort()
    const controller = new AbortController()
    session.current = controller
    const { signal } = controller
    let media: MediaStream | undefined
    let context: AudioContext | undefined
    let source: MediaStreamAudioSourceNode | undefined
    let node: AudioWorkletNode | undefined
    let ws: WebSocket | undefined
    const releaseMicrophone = () => {
      if (node) node.port.onmessage = null
      node?.disconnect()
      source?.disconnect()
      media?.getTracks().forEach((track) => track.stop())
      if (context && context.state !== "closed") void context.close()
    }
    const clean = () => {
      releaseMicrophone()
      if (ws) {
        ws.onmessage = null
        ws.onerror = null
        ws.onclose = null
        ws.close()
      }
    }
    signal.addEventListener("abort", clean, { once: true })
    setPhase("starting")
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error("请使用 HTTPS 或 localhost 并允许麦克风权限")
      context = new AudioContext({ sampleRate: 16000 })
      await context.resume()
      signal.throwIfAborted()
      media = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1 },
        video: false,
      })
      signal.throwIfAborted()
      await context.audioWorklet.addModule(processorUrl)
      signal.throwIfAborted()
      const url = new URL(
        `${(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "")}/api/speech/stream`,
        window.location.href
      )
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
      url.searchParams.set("characterId", characterId)
      ws = new WebSocket(url)
      socket.current = ws
      const connection = ws
      await new Promise<void>((resolve, reject) => {
        let ready = false
        const timeout = window.setTimeout(
          () => finish(new Error("语音连接超时")),
          15000
        )
        const cancel = () => finish(signal.reason)
        signal.addEventListener("abort", cancel, { once: true })
        const finish = (error?: Error) => {
          window.clearTimeout(timeout)
          signal.removeEventListener("abort", cancel)
          if (error) reject(error)
          else resolve()
        }
        connection.onerror = () => finish(new Error("语音连接失败"))
        connection.onclose = () => finish(new Error("语音连接已断开"))
        connection.onmessage = ({ data }) => {
          try {
            const message = JSON.parse(data)
            if (message.success === false) {
              const error = new Error(message.message || "语音识别失败")
              if (ready) toast.error(error.message)
              finish(error)
            } else if (message.type === "ready") {
              if (
                message.sampleRate !== 16000 ||
                message.format !== "pcm_s16le"
              )
                throw new Error("不支持的语音格式")
              ready = true
              finish()
            } else if (
              message.type === "transcript" &&
              typeof message.text === "string" &&
              message.text.trim()
            ) {
              transcript.current(message.text.trim())
            }
          } catch (error) {
            if (ready) {
              toast.error("无效的语音响应")
              controller.abort()
              setPhase("idle")
            }
            finish(error instanceof Error ? error : new Error("无效的语音响应"))
          }
        }
      })
      signal.throwIfAborted()
      connection.onerror = () => {
        toast.error("语音连接失败")
        controller.abort()
        setPhase("idle")
      }
      connection.onclose = () => {
        toast.error("语音连接已断开")
        controller.abort()
        setPhase("idle")
      }
      source = context.createMediaStreamSource(media)
      node = new AudioWorkletNode(context, "speech-pcm", {
        channelCount: 1,
        channelCountMode: "explicit",
      })
      node.port.onmessage = ({ data }: MessageEvent<ArrayBuffer>) => {
        if (connection.readyState !== WebSocket.OPEN) return
        if (connection.bufferedAmount > 16000 * 2 * 5) {
          toast.error("语音上传过慢，请重试")
          controller.abort()
          setPhase("idle")
          return
        }
        connection.send(data)
      }
      source.connect(node)
      node.connect(context.destination)
      stopCapture.current = releaseMicrophone
      setPhase("recording")
    } catch (error) {
      if (!signal.aborted) {
        toast.error(error instanceof Error ? error.message : "语音输入失败")
        controller.abort()
        setPhase("idle")
      }
    } finally {
      // Permission or module loading can finish after unmount.
      if (signal.aborted) clean()
    }
  }

  const stop = () => {
    stopCapture.current()
    if (socket.current?.readyState === WebSocket.OPEN)
      socket.current.send(JSON.stringify({ type: "stop" }))
    // Keep the socket alive to receive pending ASR results; next start replaces it.
    setPhase("idle")
  }

  return (
    <Button
      type="button"
      size="icon-sm"
      variant={phase === "recording" ? "destructive" : "ghost"}
      disabled={phase === "starting" || (disabled && phase !== "recording")}
      aria-label={
        phase === "recording" ? "停止流式语音输入" : "开始流式语音输入"
      }
      aria-busy={phase === "starting"}
      onClick={() => (phase === "recording" ? stop() : void start())}
    >
      {phase === "starting" ? (
        <LoaderCircleIcon className="size-4 animate-spin" />
      ) : phase === "recording" ? (
        <SquareIcon className="size-4" />
      ) : (
        <MicIcon className="size-4" />
      )}
    </Button>
  )
}
