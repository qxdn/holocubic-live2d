import type { ReactNode } from "react"
import { getToolName, type ToolUIPart, type DynamicToolUIPart } from "ai"
import { TerminalIcon, XIcon } from "lucide-react"
import { ChatProcessStep } from "@/components/chat/process-step"

const formatValue = (value: unknown) =>
  typeof value === "string" ? value : JSON.stringify(value, null, 2)

// Keep request and response visually separate without wrapping the whole step in a card.
const ToolPayload = ({ label, value }: { label: string; value: unknown }) => (
  <div className="min-w-0 overflow-hidden rounded-xl bg-muted/60 px-4 py-3">
    <p className="mb-2 text-xs font-medium text-foreground">{label}</p>
    <pre className="max-h-64 overflow-auto font-mono text-xs leading-6 break-words whitespace-pre-wrap text-foreground/80">
      {formatValue(value)}
    </pre>
  </div>
)

type ChatToolProps = {
  /** 当前工具调用片段，包含参数、执行状态及返回结果。 */
  part: ToolUIPart | DynamicToolUIPart
  /** 当前消息是否仍在生成，用于判断工具是否正在执行。 */
  streaming: boolean
  /** 工具图标，默认使用终端图标。 */
  icon?: ReactNode
  /** 执行失败或未获授权时的图标，默认使用红色叉号。 */
  failIcon?: ReactNode
}

/** Renders one tool call, including request, response and execution state. */
export const ChatTool = ({
  part,
  streaming,
  icon = <TerminalIcon className="size-4" />,
  failIcon = <XIcon className="size-4 text-destructive" />,
}: ChatToolProps) => {
  const failed = part.state === "output-error" || part.state === "output-denied"
  const done = part.state === "output-available"
  const active =
    streaming &&
    (part.state === "input-streaming" || part.state === "input-available")
  const state = failed
    ? "执行失败"
    : done
      ? "已完成"
      : part.state === "approval-requested" ||
          part.state === "approval-responded"
        ? "等待授权"
        : active
          ? "正在调用"
          : "已停止"
  return (
    <ChatProcessStep
      title={`调用 ${getToolName(part)}`}
      status={state}
      active={active}
      icon={failed ? failIcon : icon}
    >
      {part.input !== undefined ? (
        <ToolPayload label="Request" value={part.input} />
      ) : null}
      {part.state === "output-available" ? (
        <ToolPayload label="Response" value={part.output} />
      ) : null}
      {part.state === "output-error" ? (
        <ToolPayload label="Error" value={part.errorText} />
      ) : null}
      {part.state === "output-denied" ? <p>工具调用未获授权</p> : null}
    </ChatProcessStep>
  )
}
