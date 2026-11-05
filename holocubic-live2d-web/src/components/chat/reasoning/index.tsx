import type { ReasoningUIPart } from "ai"
import { useId, useState } from "react"
import { BrainIcon, ChevronDownIcon, LoaderCircleIcon } from "lucide-react"
import { MessageResponse } from "@/components/ai-elements/message"

/** Displays reasoning as a single-line preview that expands into the full text. */
export const ChatReasoning = ({
  part,
  streaming,
}: {
  part: ReasoningUIPart
  streaming: boolean
}) => {
  const active = streaming && part.state === "streaming"
  const [open, setOpen] = useState(false)
  const contentId = useId()
  const title = active ? "正在思考" : "思考已完成"
  const preview = part.text.replace(/\s+/g, " ").trim()

  return (
    <div className="min-w-0 text-muted-foreground">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full min-w-0 items-center gap-2 py-1 text-left text-sm transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
      >
        {active ? (
          <LoaderCircleIcon className="size-4 shrink-0 animate-spin motion-reduce:animate-none" />
        ) : (
          <BrainIcon className="size-4 shrink-0" />
        )}
        <span className="min-w-0 truncate">
          {open || active ? title : preview || title}
        </span>
        <ChevronDownIcon
          className={`size-3.5 shrink-0 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div id={contentId} hidden={!open}>
        {open ? (
          <div className="pt-2 pl-6 text-sm leading-7">
            <MessageResponse isAnimating={active}>{part.text}</MessageResponse>
          </div>
        ) : null}
      </div>
    </div>
  )
}
