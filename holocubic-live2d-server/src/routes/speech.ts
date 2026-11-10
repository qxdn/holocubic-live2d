import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { AppEnv } from '../env.ts'
import { asrHandler } from '../handlers/speech.ts'
import { speechStreamHandler } from '../handlers/speech-stream.ts'
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
          schema: z.string().openapi({
            type: 'string',
            format: 'binary',
            description: '16 kHz、单声道、16-bit 小端裸 PCM，不含 WAV 文件头。',
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

const speechStreamRoute = createRoute({
  method: 'get',
  path: '/speech/stream',
  operationId: 'streamSpeechForVad',
  tags: ['Speech'],
  summary: '建立实时语音 WebSocket 会话',
  description:
    '连接后持续发送 16 kHz、单声道、16-bit 小端 PCM 二进制帧。服务端使用 Silero VAD 检测语句边界，静音约 700 ms 后通过 WebSocket 返回最终识别文本。连接查询参数 characterId 选择 Character 及其 ASR 配置。',
  request: { query: asrQuerySchema },
  responses: {
    101: {
      description: 'WebSocket 握手成功；后续消息遵循语音流协议。',
    },
    400: {
      description: '缺少或无效的 characterId。',
    },
  },
})

speechRoutes.openAPIRegistry.registerPath(asrRoute)
speechRoutes.post(asrRoute.path, asrHandler)
speechRoutes.openAPIRegistry.registerPath(speechStreamRoute)
speechRoutes.get(speechStreamRoute.path, speechStreamHandler)
