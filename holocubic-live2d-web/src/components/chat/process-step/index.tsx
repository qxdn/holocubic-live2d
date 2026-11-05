import { useState, type ReactNode } from "react"
import { ChevronRightIcon, LoaderCircleIcon } from "lucide-react"

type ProcessProps = {
  title: string
  active: boolean
  icon: ReactNode
  children: ReactNode
  status?: string
}

/** Displays a tool step with details collapsed until the user expands them. */
export const ChatProcessStep = ({
  title,
  active,
  icon,
  children,
  status,
}: ProcessProps) => {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative min-w-0 pb-5 pl-7 before:absolute before:top-7 before:bottom-0 before:left-2 before:border-l before:border-dashed before:border-border">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`flex max-w-full items-center gap-2 py-1 text-left transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring ${active ? "text-foreground" : "text-muted-foreground"}`}
      >
        <span className="absolute top-1 left-0 flex size-4 items-center justify-center">
          {active ? (
            <LoaderCircleIcon className="size-4 shrink-0 animate-spin motion-reduce:animate-none" />
          ) : (
            icon
          )}
        </span>
        <span className="min-w-0 break-words">{title}</span>
        <ChevronRightIcon
          className={`size-3.5 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
        />
        {status ? (
          <span
            className={`text-xs ${status === "执行失败" ? "text-destructive" : "text-muted-foreground"}`}
          >
            {status}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="mt-3 space-y-2 text-sm leading-7 text-muted-foreground">
          {children}
        </div>
      ) : null}
    </div>
  )
}
