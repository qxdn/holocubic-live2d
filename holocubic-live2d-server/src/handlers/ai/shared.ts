import type { Context } from 'hono'
import type { ZodType } from 'zod'

export type Protocol = 'openai' | 'anthropic'

export function error(
  c: Context,
  protocol: Protocol,
  status: 400 | 502,
  message: string,
) {
  const type = status === 400 ? 'invalid_request_error' : 'api_error'
  return c.json(
    protocol === 'anthropic'
      ? { type: 'error', error: { type, message } }
      : { error: { type, message, param: null, code: null } },
    status,
  )
}

type ParseResult<T> = { data: T; error: null } | { data: null; error: string }

// 只负责 JSON 解析和校验，HTTP 错误响应由调用方构造。
export async function parseRequest<T>(
  c: Context,
  schema: ZodType<T>,
): Promise<ParseResult<T>> {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return { data: null, error: 'Invalid JSON body' }
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')
    return { data: null, error: message }
  }
  return { data: parsed.data, error: null }
}
