import { useEffect, useRef, useState } from "react"
import { Application, Ticker } from "pixi.js"
import { Live2DModel } from "pixi-live2d-display/cubism4"

Live2DModel.registerTicker(Ticker)

type Live2DProps = {
  modelUrl: string
}

/** 首次适配模型并监听容器尺寸变化，返回的观察器由组件卸载时断开。 */
const observeModelResize = (
  container: HTMLDivElement,
  app: Application,
  model: Live2DModel
) => {
  // 在缩放前记录原始尺寸，避免后续适配基于已缩放的宽高计算。
  const modelWidth = model.width
  const modelHeight = model.height
  model.anchor.set(0.5, 1)

  const resize = () => {
    const width = container.clientWidth
    const height = container.clientHeight
    // 窄屏布局隐藏容器时，同时暂停模型更新与画布渲染。
    if (!width || !height) {
      model.autoUpdate = false
      app.stop()
      return
    }

    app.renderer.resize(width, height)
    // 取较小比例保持模型完整可见，并留出 5% 的余量。
    model.scale.set(Math.min(width / modelWidth, height / modelHeight) * 0.95)
    // 锚点位于底部中央，使模型水平居中，底部保留 2% 的间距。
    model.position.set(width / 2, height * 0.98)
    model.autoUpdate = true
    app.start()
  }

  const observer = new ResizeObserver(resize)
  observer.observe(container)
  resize()
  return observer
}

/** Loads a Cubism model into its own canvas and fits it to the available space. */
export const Live2D = ({ modelUrl }: Live2DProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()

  useEffect(() => {
    const container = containerRef.current!
    let app: Application | undefined
    let observer: ResizeObserver | undefined

    const load = async () => {
      setLoading(true)
      setError(undefined)
      try {
        app = new Application({
          backgroundAlpha: 0,
          antialias: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
          autoDensity: true,
          width: Math.max(container.clientWidth, 1),
          height: Math.max(container.clientHeight, 1),
        })
        const canvas = app.view as HTMLCanvasElement
        container.appendChild(canvas)

        const model = await Live2DModel.from(modelUrl, {
          autoInteract: true,
        })
        app.stage.addChild(model)

        observer = observeModelResize(container, app, model)
      } catch (cause) {
        app?.destroy(true, { children: true, texture: true, baseTexture: true })
        app = undefined
        setError(cause instanceof Error ? cause.message : "模型加载失败")
      } finally {
        setLoading(false)
      }
    }

    void load()
    return () => {
      observer?.disconnect()
      app?.destroy(true, { children: true, texture: true, baseTexture: true })
    }
  }, [modelUrl])

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {loading || error ? (
        <p
          role={error ? "alert" : "status"}
          className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground"
        >
          {error ? `Live2D 加载失败：${error}` : "正在加载角色…"}
        </p>
      ) : null}
    </div>
  )
}
