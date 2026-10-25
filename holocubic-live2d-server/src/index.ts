// Telemetry 必须在 Hono 创建 tracer 和 meter 前初始化。
import { shutdownTelemetry } from './telemetry.ts'
import { serve } from '@hono/node-server'
import { OpenAPIHono } from '@hono/zod-openapi'
import { MastraServer } from '@mastra/hono'
import type { HonoBindings, HonoVariables } from '@mastra/hono'
import { mastra } from './core/mastra/index.ts'
import { logger } from './core/logger/index.ts'
import { registerMiddleware } from './middleware/index.ts'
import { registerRoutes } from './routes/index.ts'

const app = new OpenAPIHono<{
  Bindings: HonoBindings
  Variables: HonoVariables
}>()
registerMiddleware(app)
registerRoutes(app)

const mastraServer = new MastraServer({ app, mastra })
await mastraServer.init()

const server = serve(
  {
    fetch: app.fetch,
    port: Number(process.env.PORT ?? 3000),
  },
  (info) => {
    logger.info({ port: info.port }, 'Server is running')
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
    try {
      await mastra.shutdown()
    } finally {
      await shutdownTelemetry()
    }
    process.exitCode = error ? 1 : 0
  } catch (error) {
    logger.error({ err: error }, 'Failed to shut down server')
    process.exitCode = 1
  }
}

process.once('SIGINT', () => {
  void shutdown()
})
process.once('SIGTERM', () => {
  void shutdown()
})
