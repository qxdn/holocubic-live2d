import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { aiHandler } from '../handlers/ai/index.ts'
import {
  anthropicRequestSchema,
  openAIRequestSchema,
  anthropicResponseSchema,
  openAIResponseSchema,
  protocolErrorSchema,
} from '../models/ai.ts'

export const aiRoutes = new OpenAPIHono()

export const sseSchema = z
  .string()
  .describe(
    'SSE 事件流；每个事件的数据为协议 JSON，具体事件及结束标记见接口说明。',
  )

const openAIRoute = createRoute({
  method: 'post',
  path: '/chat/completions',
  operationId: 'createChatCompletion',
  tags: ['AI'],
  summary: 'OpenAI 兼容文本对话',
  description:
    '文本协议子集。stream=true 返回 SSE，以 [DONE] 结束；流内错误通过 error 数据返回。上游密钥由服务端配置，客户端无需认证。',
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: openAIRequestSchema } },
    },
  },
  responses: {
    200: {
      description: '非流式 JSON 或 stream=true 时的 SSE。',
      content: {
        'application/json': { schema: openAIResponseSchema },
        'text/event-stream': { schema: sseSchema },
      },
    },
    400: {
      description: 'JSON 解析失败或请求字段不合法。',
      content: {
        'application/json': { schema: protocolErrorSchema('openai') },
      },
    },
    502: {
      description: '上游请求失败。',
      content: {
        'application/json': { schema: protocolErrorSchema('openai') },
      },
    },
  },
})
const anthropicRoute = createRoute({
  method: 'post',
  path: '/messages',
  operationId: 'createMessage',
  tags: ['AI'],
  summary: 'Anthropic 兼容文本对话',
  description:
    '文本协议子集。stream=true 返回 message_start、content_block_start/delta/stop、message_delta、message_stop 事件；流内错误发送 error 事件。上游密钥由服务端配置，客户端无需认证。',
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: anthropicRequestSchema } },
    },
  },
  responses: {
    200: {
      description: '非流式 JSON 或 stream=true 时的 SSE。',
      content: {
        'application/json': { schema: anthropicResponseSchema },
        'text/event-stream': { schema: sseSchema },
      },
    },
    400: {
      description: 'JSON 解析失败或请求字段不合法。',
      content: {
        'application/json': { schema: protocolErrorSchema('anthropic') },
      },
    },
    502: {
      description: '上游请求失败。',
      content: {
        'application/json': { schema: protocolErrorSchema('anthropic') },
      },
    },
  },
})

// 仅注册文档；请求解析和校验保留在 handler，维持各协议的错误响应。
aiRoutes.openAPIRegistry.registerPath(openAIRoute)
aiRoutes.post(openAIRoute.path, aiHandler('openai'))
aiRoutes.openAPIRegistry.registerPath(anthropicRoute)
aiRoutes.post(anthropicRoute.path, aiHandler('anthropic'))
