import type { ReasoningUIPart } from "ai"
import { BrainIcon } from "lucide-react"
import { MessageResponse } from "@/components/ai-elements/message"
import { ChatProcessStep } from "@/components/chat/process-step"

/** Renders a reasoning part with its streaming state. */
export const ChatReasoning = ({
  part,
  streaming,
}: {
  part: ReasoningUIPart
  streaming: boolean
}) => {
  const active = streaming && part.state === "streaming"
  return (
    <ChatProcessStep
      title={active ? "正在思考" : "思考过程"}
      active={active}
      icon={<BrainIcon className="size-4 shrink-0" />}
    >
      <MessageResponse isAnimating={active}>{part.text}</MessageResponse>
    </ChatProcessStep>
  )
}
