import { LevaPanel, type useCreateStore } from "leva"
import { SlidersHorizontal } from "lucide-react"
import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"
import "./style.css"

export { useControls, useCreateStore } from "leva"

// 使用 CSS 变量，让 Leva 的独立主题随页面的深浅模式同步，无需重新创建 store。
const panelTheme: ComponentProps<typeof LevaPanel>["theme"] = {
  colors: {
    elevation1: "var(--card)",
    elevation2: "var(--card)",
    elevation3: "var(--muted)",
    accent1: "var(--primary)",
    accent2: "var(--primary)",
    accent3: "var(--ring)",
    highlight1: "var(--muted-foreground)",
    highlight2: "var(--foreground)",
    highlight3: "var(--foreground)",
    vivid1: "var(--destructive)",
    folderWidgetColor: "var(--muted-foreground)",
    folderTextColor: "var(--foreground)",
    toolTipBackground: "var(--popover)",
    toolTipText: "var(--popover-foreground)",
  },
  fonts: { sans: "var(--font-sans)", mono: "var(--font-sans)" },
  radii: { xs: "var(--radius)", sm: "var(--radius)", lg: "var(--radius)" },
  shadows: {
    level1: "inset 0 0 0 1px var(--border)",
  },
}

/** 预览容器配置；levaStore 必须与 useControls 使用同一个独立 store。 */
export type StoryBookProps = ComponentProps<"div"> & {
  levaStore: ReturnType<typeof useCreateStore>
  noPadding?: boolean
}

/** 基于 Lobe UI StoryBook 的预览与 Leva 面板布局，窄屏时面板移至底部。 */
export const StoryBook = ({
  levaStore,
  noPadding = false,
  className,
  children,
  ...rest
}: StoryBookProps) => (
  <div
    className={cn(
      "flex min-h-80 w-full min-w-0 flex-col overflow-hidden rounded-xl border md:flex-row",
      className
    )}
    {...rest}
  >
    <div
      className={cn(
        "relative flex min-h-80 min-w-0 flex-1 items-center justify-center overflow-auto",
        !noPadding && "px-6 py-10"
      )}
    >
      {children}
    </div>
    <aside
      aria-label="组件参数"
      className="story-book-panel w-full shrink-0 border-t bg-card md:w-72 md:border-t-0 md:border-l"
    >
      <div className="flex items-center gap-2 border-b px-4 py-3 text-xs font-medium text-muted-foreground">
        <SlidersHorizontal aria-hidden="true" className="size-3.5" />
        Controls
      </div>
      <LevaPanel
        fill
        flat
        store={levaStore}
        titleBar={false}
        theme={panelTheme}
        hideCopyButton
      />
    </aside>
  </div>
)
