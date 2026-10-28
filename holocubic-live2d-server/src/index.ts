// Telemetry 必须在 Hono 创建 tracer 和 meter 前初始化。
import { shutdownTelemetry } from './telemetry.ts'
import { openDatabase } from './core/db/index.ts'
import { serve } from '@hono/node-server'
import { OpenAPIHono } from '@hono/zod-openapi'
import { MastraServer } from '@mastra/hono'
import type { HonoBindings, HonoVariables } from '@mastra/hono'
import { mastra } from './core/mastra/index.ts'
import { registerMiddleware } from './middleware/index.ts'
import { registerRoutes } from './routes/index.ts'
import { load_config } from './config/index.ts'

const config = load_config()
const db = openDatabase(config.db)

const app = new OpenAPIHono<{
  Bindings: HonoBindings
  Variables: HonoVariables
}>()
registerMiddleware(app, db.database)
registerRoutes(app)

const mastraServer = new MastraServer({ app, mastra })
await mastraServer.init()

const server = serve(
  {
    fetch: app.fetch,
    port: config.web.port,
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
    await Promise.all([mastra.shutdown(), shutdownTelemetry(), db.close()])
    process.exitCode = error ? 1 : 0
  } catch (error) {
    console.error('Failed to shut down server', error)
    process.exitCode = 1
  }
}

process.once('SIGINT', () => {
  void shutdown()
})
process.once('SIGTERM', () => {
  void shutdown()
})
