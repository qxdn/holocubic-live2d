import { OpenAPIHono } from '@hono/zod-openapi'
import { greetingRoutes } from './greeting.ts'
import { aiRoutes } from './ai.ts'

/** 统一在 /api 下注册各模块路由。 */
export function registerRoutes(app: OpenAPIHono) {
  const api = new OpenAPIHono()
  api.route('/', greetingRoutes)
  api.route('/v1', aiRoutes)
  app.route('/api', api)
}
