import type { Hono } from 'hono'
import { errorHandler } from './error-handler.js'
import { requestContextMiddleware } from './request-context.js'
import { telemetryMiddleware } from './telemetry.js'

/** 在路由注册前统一注册中间件与异常处理。 */
export function registerMiddleware(app: Hono) {
  app.use('*', telemetryMiddleware)
  app.use('*', requestContextMiddleware)
  app.onError(errorHandler)
}
