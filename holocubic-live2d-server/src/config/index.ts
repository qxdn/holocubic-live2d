import { readFileSync } from 'node:fs'
import { z } from 'zod'

// -------------------- 配置 Schema --------------------

const webConfigSchema = z.object({
  port: z.number().int().min(0).max(65535).default(3000),
})

const websocketConfigSchema = z.object({
  noServer: z.literal(true).default(true),
  maxPayload: z
    .number()
    .int()
    .positive()
    .default(64 * 1024),
  perMessageDeflate: z.boolean().default(false),
})

const dbConfigSchema = z.object({
  type: z.string().default('sqlite'),
  url: z
    .string()
    .refine((value) => value.trim().length > 0, {
      message: '数据库 URL 不能为空',
    })
    .default('file:../data.db'),
})

const speechProviderConfigSchema = z.object({
  type: z.literal('volcengine').default('volcengine'),
  options: z
    .object({
      apiKey: z.string().trim().min(1).prefault(''),
      resourceId: z.string().trim().min(1).optional(),
      endpoint: z.url({ protocol: /^wss$/ }).optional(),
    })
    .prefault({}),
})

const speechVadConfigSchema = z.object({
  modelPath: z.string().trim().min(1).default('./assets/silero_vad_v6.onnx'),
})

const speechConfigSchema = z.object({
  vad: speechVadConfigSchema.prefault({}),
  asr: speechProviderConfigSchema.prefault({}),
})

const configSchema = z.object({
  web: webConfigSchema.prefault({}),
  websocket: websocketConfigSchema.prefault({}),
  db: dbConfigSchema.prefault({}),
  speech: speechConfigSchema.prefault({}),
})

// -------------------- 私有函数 --------------------

function readConfig(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown
}

// -------------------- 对外导出 --------------------

export type WebConfig = z.infer<typeof webConfigSchema>
export type WebSocketConfig = z.infer<typeof websocketConfigSchema>
export type DbConfig = z.infer<typeof dbConfigSchema>
export type SpeechVadConfig = z.infer<typeof speechVadConfigSchema>
export type SpeechConfig = z.infer<typeof speechConfigSchema>
export type Config = z.infer<typeof configSchema>

/** 读取配置文件，相对路径基于当前工作目录。 */
export function load_config(path: string = './config/config.json'): Config {
  return configSchema.parse(readConfig(path))
}
