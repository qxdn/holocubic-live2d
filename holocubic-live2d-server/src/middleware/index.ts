import type { Env, Hono } from 'hono'
import type { Database } from '../core/db/index.ts'
import { errorHandler } from './error-handler.ts'
import { requestContextMiddleware } from './request-context.ts'
import { telemetryMiddleware } from './telemetry.ts'

/** 在路由注册前统一注册中间件与异常处理。 */
export function registerMiddleware<E extends Env>(
  app: Hono<E>,
  database: Database,
) {
  app.use('*', telemetryMiddleware)
  app.use('*', requestContextMiddleware(database))
  app.onError(errorHandler)
}
