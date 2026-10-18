import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { OpenAPIHono } from '@hono/zod-openapi'
import { registerRoutes } from '../routes/index.ts'

const app = new OpenAPIHono()
registerRoutes(app)

const document = app.getOpenAPI31Document({
  openapi: '3.1.0',
  info: { title: 'HoloCubic Live2D API', version: '1.0.0' },
})
const output = new URL('../../openapi.json', import.meta.url)
await writeFile(output, `${JSON.stringify(document, null, 2)}\n`, 'utf8')
console.log(`OpenAPI document generated: ${fileURLToPath(output)}`)
