import type { TextUIPart, UIMessage } from "ai"
import type { ReactNode } from "react"
import "./style.css"
import {
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"

const innerThoughtTags = { think: [] }
const messageComponents = {
  think: ({ children }: { children?: ReactNode }) => (
    <span className="inner-thought">({children})</span>
  ),
}

/** Keeps incomplete think tags out of the stream and closes an active tag for rendering. */
function prepareThinkTags(text: string, streaming: boolean): string {
  let output = ""
  let cursor = 0
  let insideThought = false

  while (cursor < text.length) {
    const opening = text.indexOf("<think>", cursor)
    const closing = text.indexOf("</think>", cursor)
    const next = [opening, closing]
      .filter((index) => index !== -1)
      .sort((a, b) => a - b)[0]

    if (next === undefined) {
      let remainder = text.slice(cursor)
      if (streaming) {
        const partialTag = remainder.match(/<\/?(?:t(?:h(?:i(?:n(?:k)?)?)?)?)?$/i)
        if (partialTag) {
          remainder = remainder.slice(0, -partialTag[0].length)
        }
      }
      output += remainder
      break
    }

    output += text.slice(cursor, next)
    if (next === opening) {
      output += "<think>"
      insideThought = true
      cursor = next + "<think>".length
    } else {
      output += "</think>"
      insideThought = false
      cursor = next + "</think>".length
    }
  }

  if (insideThought) output += "</think>"
  return output
}

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
        allowedTags={innerThoughtTags}
        components={messageComponents}
        shikiTheme={["github-light", "github-dark"]}
        controls={{ code: { copy: true, download: false } }}
        lineNumbers={false}
      >
        {prepareThinkTags(part.text, streaming && part.state === "streaming")}
      </MessageResponse>
    )}
  </MessageContent>
)
