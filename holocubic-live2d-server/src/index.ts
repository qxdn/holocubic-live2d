// Telemetry 必须在 Hono 创建 tracer 和 meter 前初始化。
import { shutdownTelemetry } from './telemetry.ts'
import './core/agent/index.ts'
import { openDatabase } from './core/db/index.ts'
import { serve } from '@hono/node-server'
import { OpenAPIHono } from '@hono/zod-openapi'
import { MastraServer } from '@mastra/hono'
import type { AppEnv } from './env.ts'
import { mastra } from './core/mastra/index.ts'
import { logger } from './core/logger/index.ts'
import { registerMiddleware } from './middleware/index.ts'
import { registerRoutes } from './routes/index.ts'
import { load_config } from './config/index.ts'
import { initARS } from './core/services/speech/index.ts'

const config = load_config()
const db = openDatabase(config.db)
initARS(config.speech.asr)

const app = new OpenAPIHono<AppEnv>()
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
    await Promise.all([mastra.shutdown(), shutdownTelemetry(), db.close()])
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
