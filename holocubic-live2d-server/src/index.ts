// Telemetry 必须在 Hono 创建 tracer 和 meter 前初始化。
import { shutdownTelemetry } from './telemetry.ts'
import { serve } from '@hono/node-server'
import { OpenAPIHono } from '@hono/zod-openapi'
import { registerMiddleware } from './middleware/index.ts'
import { registerRoutes } from './routes/index.ts'

const app = new OpenAPIHono()
registerMiddleware(app)
registerRoutes(app)

const server = serve(
  {
    fetch: app.fetch,
    port: Number(process.env.PORT ?? 3000),
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`)
  },
)

let shuttingDown = false
async function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  try {
    const error = await new Promise<Error | undefined>((resolve) => {
      server.close(resolve)
    })
    await shutdownTelemetry()
    process.exitCode = error ? 1 : 0
  } catch (error) {
    console.error('Failed to shut down telemetry', error)
    process.exitCode = 1
  }
}

process.once('SIGINT', () => {
  void shutdown()
})
process.once('SIGTERM', () => {
  void shutdown()
})
