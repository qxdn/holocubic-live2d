import type { TextUIPart, UIMessage } from "ai"
import {
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"

/** Renders user text or streaming assistant Markdown. */
export const ChatText = ({
  part,
  role,
  streaming,
}: {
  part: TextUIPart
  role: UIMessage["role"]
  streaming: boolean
}) => (
  <MessageContent>
    {role === "user" ? (
      <p className="whitespace-pre-wrap">{part.text}</p>
    ) : (
      <MessageResponse isAnimating={streaming && part.state === "streaming"}>
        {part.text}
      </MessageResponse>
    )}
  </MessageContent>
)
