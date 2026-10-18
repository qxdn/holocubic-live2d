import { randomBytes } from 'node:crypto'
import { isSpanContextValid, trace } from '@opentelemetry/api'
import type { Context, MiddlewareHandler } from 'hono'
import { setTraceIdHeader } from '../utils/headers.js'

declare module 'hono' {
  interface ContextVariableMap {
    traceId: string
  }
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
export const requestContextMiddleware: MiddlewareHandler = async (c, next) => {
  const traceId = ensureTraceId(c)
  setTraceIdHeader(c, traceId)
  await next()
  setTraceIdHeader(c, traceId)
}
