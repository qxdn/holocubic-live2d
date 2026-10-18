import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { rootHandler } from '../handlers/root.ts'
import { greetingResponseSchema } from '../models/greeting.ts'

export const greetingRoutes = new OpenAPIHono()

const greetingRoute = createRoute({
  method: 'get',
  path: '/',
  operationId: 'getGreeting',
  tags: ['Greeting'],
  summary: '获取服务问候信息',
  responses: {
    200: {
      description: '统一业务响应，success 表示业务是否成功。',
      content: { 'application/json': { schema: greetingResponseSchema } },
    },
  },
})
greetingRoutes.openAPIRegistry.registerPath(greetingRoute)
greetingRoutes.get(greetingRoute.path, rootHandler)
