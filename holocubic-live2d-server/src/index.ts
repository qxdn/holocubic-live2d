// Telemetry 必须在 Hono 创建 tracer 和 meter 前初始化。
import { shutdownTelemetry } from './telemetry.js'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { registerMiddleware } from './middleware/index.js'
import { registerRoutes } from './routes/index.js'

const app = new Hono()
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
function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  server.close(async (error) => {
    try {
      await shutdownTelemetry()
      process.exitCode = error ? 1 : 0
    } catch (error) {
      console.error('Failed to shut down telemetry', error)
      process.exitCode = 1
    }
  })
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
