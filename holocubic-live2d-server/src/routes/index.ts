import { OpenAPIHono } from '@hono/zod-openapi'
import type { Env } from 'hono'
import { chatRoutes } from './chat.ts'
import { live2dRoutes } from './live2d.ts'
import { speechRoutes } from './speech.ts'

/** 统一在 /api 下注册各模块路由。 */
export function registerRoutes<E extends Env>(app: OpenAPIHono<E>): void {
  const api = new OpenAPIHono()
  api.route('/', chatRoutes)
  api.route('/', live2dRoutes)
  api.route('/', speechRoutes)
  app.route('/api', api)
}
