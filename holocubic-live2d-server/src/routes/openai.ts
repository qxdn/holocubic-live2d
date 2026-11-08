import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { openAIChatCompletionsHandler } from '../handlers/openai.ts'

export const openAIRoutes = new OpenAPIHono()

const chatCompletionsRoute = createRoute({
  method: 'post',
  path: '/chat/completions',
  operationId: 'createChatCompletion',
  tags: ['OpenAI Compatible'],
  summary: 'OpenAI Chat Completions compatible endpoint',
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: z.object({
            model: z.string().min(1),
            messages: z.array(z.object({
              role: z.enum(['system', 'user', 'assistant']),
              content: z.string(),
            })).min(1),
            stream: z.boolean().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Chat completion or server-sent event stream.',
      content: {
        'application/json': { schema: z.object({ id: z.string(), object: z.literal('chat.completion'), created: z.number(), model: z.string(), choices: z.array(z.unknown()) }) },
        'text/event-stream': { schema: z.string() },
      },
    },
  },
})

openAIRoutes.openapi(chatCompletionsRoute, openAIChatCompletionsHandler)
