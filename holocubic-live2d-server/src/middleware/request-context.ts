import type { ServiceContext } from '../core/context.ts'
import { createServiceContext } from '../core/context.ts'
import type { Database } from '../core/db/index.ts'
import { randomBytes } from 'node:crypto'
import { isSpanContextValid, trace } from '@opentelemetry/api'
import type { Context, MiddlewareHandler } from 'hono'
import { setTraceIdHeader } from '../utils/headers.ts'

declare module 'hono' {
  interface ContextVariableMap {
    traceId: string
    serviceContext: ServiceContext
  }
}

/** 获取当前请求的 service 上下文。 */
export function getServiceContext(c: Context): ServiceContext {
  return c.get('serviceContext')
}

export function ensureTraceId(c: Context): string {
  const existing = c.get('traceId')
  if (existing) return existing
  const spanContext = trace.getActiveSpan()?.spanContext()
  const traceId =
    spanContext && isSpanContextValid(spanContext)
      ? spanContext.traceId
      : randomBytes(16).toString('hex')
  c.set('traceId', traceId)
  return traceId
}

/** Register after telemetry so the active server span is available. */
export const requestContextMiddleware =
  (database: Database): MiddlewareHandler =>
  async (c, next) => {
    c.set('serviceContext', createServiceContext(database))
    const traceId = ensureTraceId(c)
    setTraceIdHeader(c, traceId)
    await next()
    setTraceIdHeader(c, traceId)
  }
