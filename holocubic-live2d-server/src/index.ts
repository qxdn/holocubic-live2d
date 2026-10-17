import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { registerRoutes } from './routes/index.js'

const app = new Hono()

registerRoutes(app)

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
