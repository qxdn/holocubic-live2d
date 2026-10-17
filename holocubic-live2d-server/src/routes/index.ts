import { Hono } from 'hono'
import { greetingRoutes } from './greeting.js'

/** 统一在 /api 下注册各模块路由。 */
export function registerRoutes(app: Hono) {
  const api = new Hono()
  api.route('/', greetingRoutes)
  app.route('/api', api)
}
