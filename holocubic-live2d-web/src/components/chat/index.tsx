import { ChatMessage } from "@/components/chat/message"
import { SpeechInput } from "@/components/chat/speech-input"
import { ChatEmptyState } from "@/components/chat/empty-state"
import type { ChatStatus, UIMessage } from "ai"
import { SparklesIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input"

type ChatProps = {
  characterId: string
  messages: UIMessage[]
  status: ChatStatus
  error?: Error
  input: string
  onInputChange: (value: string) => void
  onSend: (text: string) => void
  onStop: () => void
  onRegenerate: () => void
}

/** Renders the chat UI using state and actions provided by the parent. */
export const Chat = ({
  characterId,
  messages,
  status,
  error,
  input,
  onInputChange,
  onSend,
  onStop,
  onRegenerate,
}: ChatProps) => {
  const busy = status === "submitted" || status === "streaming"
  return (
    <>
      {!messages.length ? (
        <ChatEmptyState
          icon={<SparklesIcon className="size-7" />}
          title="有什么可以帮你的？"
          description="聊聊想法、问个问题，或一起解决难题。"
        />
      ) : (
        <Conversation className="min-h-0">
          <ConversationContent className="mx-auto w-full max-w-3xl gap-8 px-5 py-8 sm:px-8">
            {messages.map((message, index) => (
              <ChatMessage
                key={message.id}
                message={message}
                busy={busy}
                streaming={
                  busy &&
                  index === messages.length - 1 &&
                  message.role === "assistant"
                }
                isLast={index === messages.length - 1}
                onRegenerate={onRegenerate}
              />
            ))}
            {status === "submitted" ? (
              <p
                role="status"
                className="animate-pulse text-sm text-muted-foreground"
              >
                正在思考…
              </p>
            ) : null}
          </ConversationContent>
          <ConversationScrollButton aria-label="滚动到最新消息" />
        </Conversation>
      )}
      <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pt-3 pb-4 sm:px-8 sm:pb-6">
        {error ? (
          <div
            role="alert"
            className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 px-4 py-2 text-sm"
          >
            <span>回复失败：{error.message}</span>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={onRegenerate}
            >
              重试
            </Button>
          </div>
        ) : null}
        <PromptInput onSubmit={({ text }) => onSend(text)}>
          <PromptInputBody>
            <PromptInputTextarea
              className="py-5 leading-6"
              aria-label="消息"
              placeholder="发送消息…"
              value={input}
              onChange={(event) => onInputChange(event.target.value)}
              disabled={busy}
            />
          </PromptInputBody>
          <PromptInputFooter className="justify-end">
            <SpeechInput
              characterId={characterId}
              disabled={busy}
              onTranscript={(text) =>
                onInputChange(input ? `${input} ${text}` : text)
              }
            />
            <PromptInputSubmit
              status={status}
              onStop={onStop}
              disabled={!busy && !input.trim()}
              aria-label={busy ? "停止生成" : "发送消息"}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </>
  )
}
