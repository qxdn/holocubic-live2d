import { useMemo, useRef, useState } from "react"
import { button, folder, Leva } from "leva"
import { useChat } from "@ai-sdk/react"
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai"
import { Chat } from "@/components/chat"
import { useTts } from "@/components/chat/use-tts"
import { toast } from "sonner"
import { Live2D, getMotions } from "@/components/live2d"
import type { Live2DHandle } from "@/components/live2d"
import { StoryBook, useControls } from "@/components/story-book"
import { MoonIcon, SquarePenIcon, SparklesIcon, SunIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/theme-provider"
import { isDev } from "@/lib/env"

const modelUrls = {
  Haru: `${import.meta.env.BASE_URL}models/Haru/Haru.model3.json`,
  Hiyori: `${import.meta.env.BASE_URL}models/Hiyori/Hiyori.model3.json`,
}

const characterId = "testAgent"

/** Owns page layout and chat data flow; sessions reset on page reload. */
export const App = () => {
  const tts = useTts()
  const live2dRef = useRef<Live2DHandle>(null)
  const { theme, setTheme } = useTheme()

  const [{ modelUrl }] = useControls(
    () => ({
      Live2D: folder({
        modelUrl: {
          label: "模型",
          value: modelUrls.Haru,
          options: modelUrls,
        },
      }),
    }),
    []
  )

  const motions = getMotions(modelUrl)
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { characterId },
      }),
    []
  )
  useControls(
    () => ({
      Live2D: folder({
        motionName: {
          label: "动作名称",
          value: motions.keys().next().value,
          options: Array.from(motions.keys()),
        },
        播放动作: button((get) => {
          void live2dRef.current
            ?.playMotion(get("Live2D.motionName"))
            .catch(console.error)
        }),
      }),
    }),
    [motions]
  )

  const [input, setInput] = useState("")
  const {
    messages,
    sendMessage,
    status,
    stop,
    regenerate,
    setMessages,
    error,
    clearError,
    addToolOutput,
  } = useChat({
    transport,
    onData(part) {
      if (part.type === "data-audio") tts.play(part.data)
      // audio-end closes synthesis; queued browser audio must finish playing.
    },
    onError() {
      tts.clean()
    },
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    async onToolCall({ toolCall }) {
      if (toolCall.toolName !== "live2d_motion") return

      try {
        const input = toolCall.input
        if (
          typeof input !== "object" ||
          input === null ||
          !("name" in input) ||
          typeof input.name !== "string"
        ) {
          throw new Error("Live2D 动作参数缺少 name")
        }

        const live2d = live2dRef.current
        if (!live2d) throw new Error("Live2D 尚未就绪")
        const output = await live2d.playMotion(input.name)
        // SDK 在处理工具回调时等待本函数，结果写入不能在这里 await。
        void addToolOutput({
          tool: "live2d_motion",
          toolCallId: toolCall.toolCallId,
          output,
        })
      } catch (cause) {
        void addToolOutput({
          tool: "live2d_motion",
          toolCallId: toolCall.toolCallId,
          state: "output-error",
          errorText:
            cause instanceof Error ? cause.message : "Live2D 动作播放失败",
        })
      }
    },
  })
  const busy = status === "submitted" || status === "streaming"

  const [{ enableTts }] = useControls(
    "TTS",
    () => ({
      enableTts: {
        label: "朗读",
        value: false,
        transient: false,
        disabled: busy,
        onChange: (_value: boolean, _path, { initial }) => {
          if (initial) return
          tts.clean()
        },
      },
    }),
    [busy]
  )

  const handleSend = async (text: string) => {
    if (busy || !text.trim()) return
    try {
      if (enableTts) await tts.prepare()
      else tts.clean()
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "音频播放初始化失败")
      return
    }
    clearError()
    void sendMessage({ text: text.trim() }, { body: { enableTts } })
    setInput("")
  }

  const handleNewChat = () => {
    if (busy) return
    tts.clean()
    setMessages([])
    clearError()
    setInput("")
  }

  return (
    <main className="flex h-svh w-full flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-16 shrink-0 items-center justify-between border-b px-5 sm:px-6">
        <div className="flex items-center gap-2 font-semibold">
          <SparklesIcon className="size-5" />
          HoloCubic{" "}
          <span className="font-normal text-muted-foreground">Chat</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={busy || !messages.length}
            onClick={handleNewChat}
          >
            <SquarePenIcon className="size-4" />
            新对话
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="切换深色 / 浅色模式"
            title="切换深色 / 浅色模式"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? (
              <SunIcon className="size-4" />
            ) : (
              <MoonIcon className="size-4" />
            )}
          </Button>
        </div>
      </header>
      {isDev ? <StoryBook mode="floating" /> : <Leva hidden />}
      {/* 侧栏预留给设置与 Live2D；窄屏先保证聊天区域可用。 */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section
          aria-label="Chat"
          className="flex min-h-0 min-w-0 flex-col overflow-hidden"
        >
          <Chat
            characterId={characterId}
            messages={messages}
            status={status}
            error={error}
            input={input}
            onInputChange={setInput}
            onSend={handleSend}
            onStop={() => {
              tts.clean()
              void stop()
            }}
            onRegenerate={async () => {
              if (busy) return
              try {
                if (enableTts) await tts.prepare()
                else tts.clean()
                void regenerate({ body: { enableTts } })
              } catch (cause) {
                toast.error(
                  cause instanceof Error ? cause.message : "音频播放初始化失败"
                )
              }
            }}
          />
        </section>
        <aside
          aria-label="Live2D"
          className="relative hidden min-h-0 overflow-hidden border-l lg:block"
        >
          <Live2D ref={live2dRef} modelUrl={modelUrl} />
        </aside>
      </div>
      <footer aria-label="页脚预留区域" className="h-10 shrink-0 border-t" />
    </main>
  )
}

export default App
