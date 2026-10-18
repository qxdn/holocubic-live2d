import { SpanStatusCode, trace } from '@opentelemetry/api'
import type { ErrorHandler } from 'hono'
import { fail } from '../utils/index.ts'
import { ensureTraceId } from './request-context.ts'

/** Catch request errors; business failures still use HTTP 200. */
export const errorHandler: ErrorHandler = (error, c) => {
  const traceId = ensureTraceId(c)
  const span = trace.getActiveSpan()
  span?.recordException(error)
  span?.setStatus({ code: SpanStatusCode.ERROR })
  console.error('Request failed', { traceId, error })

  return fail(c, error)
}
