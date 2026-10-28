import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import {
  getLive2dModelHandler,
  pageLive2dModelsHandler,
} from '../handlers/live2d.ts'
import {
  live2dModelPageRequestSchema,
  live2dModelPageResponseSchema,
  live2dModelResponseSchema,
} from '../models/live2d.ts'

const live2dRoutes = new OpenAPIHono()

// createRoute：定义路由契约
const pageLive2dModelsRoute = createRoute({
  method: 'get',
  path: '/live2d/page',
  operationId: 'pageLive2dModels',
  tags: ['Live2D'],
  summary: '分页获取可用的 Live2D 模型',
  request: { query: live2dModelPageRequestSchema },
  responses: {
    200: {
      description: '统一业务响应，data 为模型分页结果。',
      content: {
        'application/json': { schema: live2dModelPageResponseSchema },
      },
    },
  },
})

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

// OpenAPI：注册接口文档
live2dRoutes.openAPIRegistry.registerPath(pageLive2dModelsRoute)
live2dRoutes.openAPIRegistry.registerPath(getLive2dModelRoute)

// Handler：关联路由与处理函数
live2dRoutes.get('/live2d/page', pageLive2dModelsHandler)
live2dRoutes.get('/live2d/model/:id', getLive2dModelHandler)

export { live2dRoutes }
