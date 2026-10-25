import { useRef, useState } from "react"
import { button, folder } from "leva"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Chat } from "@/components/chat"
import { Live2D, motions } from "@/components/live2d"
import type { Live2DHandle } from "@/components/live2d"
import { StoryBook, useControls } from "@/components/story-book"
import { SquarePenIcon, SparklesIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

const transport = new DefaultChatTransport({ api: "/api/chat" })
const initialModelUrl = `${import.meta.env.BASE_URL}models/Haru/Haru.model3.json`

/** Owns page layout and chat data flow; sessions reset on page reload. */
export const App = () => {
  const live2dRef = useRef<Live2DHandle>(null)

  const [{ mode: storyBookMode }] = useControls(() => ({
    StoryBook: folder({
      mode: {
        label: "展示模式",
        options: { panel: "panel", floating: "floating" } as const,
      },
    }),
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
  }))

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
  } = useChat({ transport })
  const busy = status === "submitted" || status === "streaming"

  const handleSend = (text: string) => {
    if (busy || !text.trim()) return
    clearError()
    void sendMessage({ text: text.trim() })
    setInput("")
  }

  const handleNewChat = () => {
    if (busy) return
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
        </div>
      </header>
      {/* 侧栏预留给设置与 Live2D；窄屏先保证聊天区域可用。 */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,6fr)_minmax(0,3fr)]">
        <aside
          aria-label="StoryBook"
          className="hidden min-h-0 overflow-y-auto border-r lg:block"
        >
          <StoryBook mode={storyBookMode} />
        </aside>
        <section
          aria-label="Chat"
          className="flex min-h-0 min-w-0 flex-col overflow-hidden"
        >
          <Chat
            messages={messages}
            status={status}
            error={error}
            input={input}
            onInputChange={setInput}
            onSend={handleSend}
            onStop={() => void stop()}
            onRegenerate={() => {
              if (!busy) void regenerate()
            }}
          />
        </section>
        <aside
          aria-label="Live2D"
          className="relative hidden min-h-0 overflow-hidden border-l lg:block"
        >
          <Live2D ref={live2dRef} modelUrl={initialModelUrl} />
        </aside>
      </div>
      <footer aria-label="页脚预留区域" className="h-10 shrink-0 border-t" />
    </main>
  )
}

export default App
