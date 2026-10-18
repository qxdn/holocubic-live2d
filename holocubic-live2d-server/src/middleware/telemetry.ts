import { context, metrics, propagation, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api'
import type { MiddlewareHandler } from 'hono'
import { matchedRoutes } from 'hono/route'

const tracer = trace.getTracer('holocubic-live2d-server')
const meter = metrics.getMeter('holocubic-live2d-server')
const duration = meter.createHistogram('http.server.request.duration', {
  unit: 's',
  description: 'HTTP request duration',
})

export const telemetryMiddleware: MiddlewareHandler = async (c, next) => {
  const parent = propagation.extract(context.active(), c.req.header())
  return tracer.startActiveSpan(c.req.method, { kind: SpanKind.SERVER }, parent, async (span) => {
    const start = performance.now()
    try {
      await next()
    } finally {
      // Only route templates become attributes; never record query strings or headers.
      const route = matchedRoutes(c)
        .filter((r) => r.method !== 'ALL')
        .at(-1)?.path
      const status = c.res.status
      const attributes = {
        'http.request.method': c.req.method,
        'http.response.status_code': status,
        ...(route ? { 'http.route': route } : {}),
      }
      span.updateName(`${c.req.method} ${route || 'unmatched'}`)
      span.setAttributes(attributes)
      if (status >= 500) span.setStatus({ code: SpanStatusCode.ERROR })
      duration.record((performance.now() - start) / 1000, attributes)
      span.end()
    }
  })
}
