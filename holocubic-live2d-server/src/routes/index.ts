import { OpenAPIHono } from '@hono/zod-openapi'
import type { Env } from 'hono'
import { greetingRoutes } from './greeting.ts'

/** 统一在 /api 下注册各模块路由。 */
export function registerRoutes<E extends Env>(app: OpenAPIHono<E>) {
  const api = new OpenAPIHono()
  api.route('/', greetingRoutes)
  app.route('/api', api)
}
