import type { TextUIPart, UIMessage } from "ai"
import "./style.css"
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
      <MessageResponse
        className="chat-markdown"
        isAnimating={streaming && part.state === "streaming"}
        shikiTheme={["github-light", "github-dark"]}
        controls={{ code: { copy: true, download: false } }}
        lineNumbers={false}
      >
        {part.text}
      </MessageResponse>
    )}
  </MessageContent>
)
