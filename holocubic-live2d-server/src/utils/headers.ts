import type { Context } from 'hono'

/** 统一设置响应中的请求追踪标识。 */
export function setTraceIdHeader(c: Context, traceId: string): void {
  c.header('X-Trace-Id', traceId)
}
