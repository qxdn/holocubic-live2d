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

const configSchema = z.object({
  web: webConfigSchema.prefault({}),
  db: dbConfigSchema.prefault({}),
})

// -------------------- 私有函数 --------------------

function readConfig(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown
}

// -------------------- 对外导出 --------------------

export type WebConfig = z.infer<typeof webConfigSchema>
export type DbConfig = z.infer<typeof dbConfigSchema>
export type Config = z.infer<typeof configSchema>

/** 读取配置文件，相对路径基于当前工作目录。 */
export function load_config(path: string = './config/config.json'): Config {
  return configSchema.parse(readConfig(path))
}
