import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { getLive2dModelHandler } from '../handlers/live2d.ts'
import { live2dModelResponseSchema } from '../models/live2d.ts'

export const live2dRoutes = new OpenAPIHono()

const getLive2dModelRoute = createRoute({
  method: 'get',
  path: '/live2d/model/{id}',
  operationId: 'getLive2dModel',
  tags: ['Live2D'],
  summary: '按 ID 获取 Live2D 模型',
  request: {
    params: z.object({ id: z.string().min(1) }),
  },
  responses: {
    200: {
      description: '统一业务响应，data 为模型信息，未找到时为 null。',
      content: { 'application/json': { schema: live2dModelResponseSchema } },
    },
  },
})

live2dRoutes.openAPIRegistry.registerPath(getLive2dModelRoute)
live2dRoutes.get('/live2d/model/:id', getLive2dModelHandler)
