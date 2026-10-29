import { SpanStatusCode, trace } from '@opentelemetry/api'
import type { ErrorHandler } from 'hono'
import { logger } from '../core/logger/index.ts'
import { fail } from '../utils/index.ts'
import { ensureTraceId } from './request-context.ts'

/** Catch request errors; business failures still use HTTP 200. */
export const errorHandler: ErrorHandler = (error, c) => {
  const traceId = ensureTraceId(c)
  const span = trace.getActiveSpan()
  span?.recordException(error)
  span?.setStatus({ code: SpanStatusCode.ERROR })
  logger.error({ traceId, err: error }, 'Request failed')

  return fail(c, error)
}
