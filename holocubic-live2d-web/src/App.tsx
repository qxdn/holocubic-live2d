import type { ComponentProps } from "react"
import { Button } from "@/components/ui/button"
import { StoryBook, useControls, useCreateStore } from "@/components/story-book"

type ButtonVariant = NonNullable<ComponentProps<typeof Button>["variant"]>
type ButtonSize = NonNullable<ComponentProps<typeof Button>["size"]>

const variants: ButtonVariant[] = [
  "default",
  "secondary",
  "outline",
  "ghost",
  "destructive",
  "link",
]
const sizes: ButtonSize[] = ["xs", "sm", "default", "lg"]

/** 组件交互预览入口，每个示例使用独立的 Leva store。 */
export const App = () => {
  const textStore = useCreateStore()
  const { color, fontSize, fontWeight, text, upperCase } = useControls(
    {
      color: "#ff005b",
      fontSize: { value: 14, min: 4, max: 100, step: 2 },
      fontWeight: { value: "normal", options: ["normal", "bold"] },
      text: "StoryBook",
      upperCase: false,
    },
    { store: textStore }
  )
  const store = useCreateStore()
  const { label, variant, size, disabled } = useControls(
    {
      label: { label: "按钮文字", value: "Hello, HoloCubic" },
      variant: { label: "样式", options: variants },
      size: { label: "尺寸", options: sizes, value: sizes[2] },
      disabled: { label: "禁用", value: false },
    },
    { store }
  )

  return (
    <main className="mx-auto min-h-svh max-w-5xl px-5 py-12 sm:px-8 sm:py-20">
      <p className="mb-3 text-xs font-medium tracking-widest text-muted-foreground">
        HOLOCUBIC / COMPONENTS
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">StoryBook</h1>
      <p className="mt-3 mb-8 text-sm leading-7 text-muted-foreground">
        组件的交互预览。调整右侧参数，即时查看组件的不同状态。
      </p>
      <StoryBook levaStore={textStore} className="mb-6">
        <div style={{ color, fontSize, fontWeight }}>
          {upperCase ? text.toUpperCase() : text}
        </div>
      </StoryBook>
      <StoryBook levaStore={store}>
        <Button variant={variant} size={size} disabled={disabled}>
          {label}
        </Button>
      </StoryBook>
      <p className="mt-4 text-xs text-muted-foreground">
        按 <kbd className="rounded border px-1.5 py-0.5 font-mono">D</kbd>{" "}
        切换浅色 / 深色主题
      </p>
    </main>
  )
}

export default App
