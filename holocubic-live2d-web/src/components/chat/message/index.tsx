import { isToolUIPart, type UIMessage } from "ai"
import { CopyIcon, RotateCcwIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Message } from "@/components/ai-elements/message"
import { ChatText } from "@/components/chat/text"
import { ChatReasoning } from "@/components/chat/reasoning"
import { ChatTool } from "@/components/chat/tool"

type ChatMessageProps = {
  /** 当前消息，包含角色和按顺序排列的内容片段。 */
  message: UIMessage
  /** 当前消息是否正在接收流式内容，用于文字动画和工具执行状态。 */
  streaming: boolean
  /** 整个会话是否正在等待或生成回复；期间隐藏复制和重新生成操作。 */
  busy: boolean
  /** 是否为消息列表的最后一条；仅最后一条助手消息显示重新生成按钮。 */
  isLast: boolean
  /** 点击重新生成时通知父组件，由父组件重新请求回复。 */
  onRegenerate: () => void
}

/** Renders one message in part order; copy includes only this message's text. */
export const ChatMessage = ({
  message,
  streaming,
  busy,
  isLast,
  onRegenerate,
}: ChatMessageProps) => {
  const text = message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("")
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success("已复制回答")
    } catch {
      toast.error("复制失败，请手动选择文字复制")
    }
  }
  return (
    <Message from={message.role}>
      {message.parts.map((part, index) => {
        switch (part.type) {
          case "text":
            return (
              <ChatText
                key={index}
                part={part}
                role={message.role}
                streaming={streaming}
              />
            )
          case "reasoning":
            return (
              <ChatReasoning key={index} part={part} streaming={streaming} />
            )
          default:
            if (isToolUIPart(part)) {
              return (
                <ChatTool
                  key={part.toolCallId}
                  part={part}
                  streaming={streaming}
                />
              )
            }
            return null
        }
      })}
      {message.role === "assistant" && text && !busy ? (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="复制回答"
            title="复制回答"
            onClick={() => void copy(text)}
          >
            <CopyIcon className="size-4" />
          </Button>
          {isLast ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="重新生成"
              title="重新生成"
              onClick={onRegenerate}
            >
              <RotateCcwIcon className="size-4" />
            </Button>
          ) : null}
        </div>
      ) : null}
    </Message>
  )
}
