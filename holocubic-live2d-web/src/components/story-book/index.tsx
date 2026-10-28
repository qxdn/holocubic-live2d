import {
  Leva,
  LevaPanel,
  levaStore as defaultStore,
  type useCreateStore,
} from "leva"
import { SlidersHorizontal } from "lucide-react"
import type { ComponentProps } from "react"
import { createPortal } from "react-dom"

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
  space: { rowGap: "12px" },
  sizes: { rowHeight: "32px" },
  radii: { xs: "var(--radius)", sm: "var(--radius)", lg: "var(--radius)" },
  shadows: {
    level1: "inset 0 0 0 1px var(--border)",
  },
}

/** 默认展示 useControls 注册的全局控件；也可传入独立 store。 */
export type StoryBookProps = ComponentProps<"div"> & {
  /** 面板标题；不传时不显示自定义标题栏。 */
  title?: string
  levaStore?: ReturnType<typeof useCreateStore>
  /** panel 嵌入父容器；floating 使用带拖动标题栏的浮窗。 */
  mode?: "panel" | "floating"
}

/** 全局调试面板；各组件通过 useControls(模块名, schema) 注册分组。 */
export const StoryBook = ({
  levaStore = defaultStore,
  mode = "panel",
  title,
  className,
  ...rest
}: StoryBookProps) => {
  if (mode === "floating") {
    return createPortal(
      <div className={cn("story-book-panel", className)} {...rest}>
        <Leva hidden />
        <LevaPanel store={levaStore} theme={panelTheme} hideCopyButton />
      </div>,
      document.body
    )
  }

  return (
    <div
      className={cn("story-book-panel", "w-full min-w-0 bg-card", className)}
      {...rest}
    >
      {/* 接管全局面板，阻止 useControls 自动创建浮动窗口。 */}
      <Leva hidden />
      {title && (
        <div className="flex items-center gap-2 border-b px-4 py-3 text-xs font-medium text-muted-foreground">
          <SlidersHorizontal aria-hidden="true" className="size-3.5" />
          {title}
        </div>
      )}
      <LevaPanel
        fill
        flat
        store={levaStore}
        titleBar={false}
        theme={panelTheme}
        hideCopyButton
      />
    </div>
  )
}
