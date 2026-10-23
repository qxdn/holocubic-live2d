import type { ReactNode } from "react"

type ChatEmptyStateProps = {
  icon: ReactNode
  title: string
  description: string
}

/** 在尚无消息时展示聊天欢迎语。 */
export const ChatEmptyState = ({
  icon,
  title,
  description,
}: ChatEmptyStateProps) => (
  <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
    <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
      {icon}
    </div>
    <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
      {title}
    </h1>
    <p className="text-sm text-muted-foreground">{description}</p>
  </div>
)
