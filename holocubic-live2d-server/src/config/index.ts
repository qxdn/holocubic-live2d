import { readFileSync } from 'node:fs'
import { z } from 'zod'

// -------------------- 配置 Schema --------------------

const webConfigSchema = z.object({
  port: z.number().int().min(0).max(65535).default(3000),
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
  type: z.literal('volcengine'),
  options: z.object({
    apiKey: z.string().trim().min(1),
    resourceId: z.string().trim().min(1).optional(),
    endpoint: z.url({ protocol: /^wss$/ }).optional(),
  }),
})

const speechConfigSchema = z.object({
  asr: speechProviderConfigSchema.optional(),
})

const configSchema = z.object({
  web: webConfigSchema.prefault({}),
  db: dbConfigSchema.prefault({}),
  speech: speechConfigSchema.optional(),
})

// -------------------- 私有函数 --------------------

function readConfig(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown
}

// -------------------- 对外导出 --------------------

export type WebConfig = z.infer<typeof webConfigSchema>
export type DbConfig = z.infer<typeof dbConfigSchema>
export type SpeechConfig = z.infer<typeof speechConfigSchema>
export type Config = z.infer<typeof configSchema>

/** 读取配置文件，相对路径基于当前工作目录。 */
export function load_config(path: string = './config/config.json'): Config {
  return configSchema.parse(readConfig(path))
}
