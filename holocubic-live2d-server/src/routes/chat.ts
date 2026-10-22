import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { chatHandler } from '../handlers/chat.ts'
import { chatRequestSchema } from '../models/chat.ts'

export const chatRoutes = new OpenAPIHono()

const chatRoute = createRoute({
  method: 'post',
  path: '/chat',
  operationId: 'chat',
  tags: ['Chat'],
  summary: '与测试 Agent 对话，返回 AI SDK UI message 流',
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: chatRequestSchema } },
    },
  },
  responses: {
    200: {
      description: 'AI SDK UI message SSE 流。',
      content: { 'text/event-stream': { schema: z.string() } },
    },
  },
})

chatRoutes.openAPIRegistry.registerPath(chatRoute)
chatRoutes.post(chatRoute.path, chatHandler)
