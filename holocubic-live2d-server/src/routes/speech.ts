import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { AppEnv } from '../env.ts'
import { asrHandler } from '../handlers/speech.ts'
import { asrQuerySchema, asrResponseSchema } from '../models/speech.ts'

export const speechRoutes = new OpenAPIHono<AppEnv>()

const asrRoute = createRoute({
  method: 'post',
  path: '/speech/asr',
  operationId: 'transcribeAudio',
  tags: ['Speech'],
  summary: '提交完整 PCM 音频并返回识别文本',
  request: {
    query: asrQuerySchema,
    body: {
      required: true,
      content: {
        'application/octet-stream': {
          schema: z
            .string()
            .openapi({
              type: 'string',
              format: 'binary',
              description:
                '16 kHz、单声道、16-bit 小端裸 PCM，不含 WAV 文件头。',
            }),
        },
      },
    },
  },
  responses: {
    200: {
      description:
        '统一业务响应，data.text 为最终文本；失败时返回统一业务错误。',
      content: { 'application/json': { schema: asrResponseSchema } },
    },
  },
})

speechRoutes.openAPIRegistry.registerPath(asrRoute)
speechRoutes.post(asrRoute.path, asrHandler)
