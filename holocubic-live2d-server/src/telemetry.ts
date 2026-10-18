import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import {
  defaultResource,
  resourceFromAttributes,
} from '@opentelemetry/resources'
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { NodeSDK } from '@opentelemetry/sdk-node'

// Load before the application creates tracers and meters.
const sdk =
  process.env.OTEL_SDK_DISABLED === 'true'
    ? undefined
    : new NodeSDK({
        resource: defaultResource().merge(
          resourceFromAttributes({
            'service.name':
              process.env.OTEL_SERVICE_NAME || 'holocubic-live2d-server',
          }),
        ),
        traceExporter: new OTLPTraceExporter(),
        metricReaders: [
          new PeriodicExportingMetricReader({
            exporter: new OTLPMetricExporter(),
          }),
        ],
        logRecordProcessors: [],
      })

sdk?.start()

export async function shutdownTelemetry() {
  await sdk?.shutdown()
}
