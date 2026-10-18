import { Hono } from 'hono'
import { aiHandler } from '../handlers/ai/index.js'

export const aiRoutes = new Hono()
aiRoutes.post('/chat/completions', aiHandler('openai'))
aiRoutes.post('/messages', aiHandler('anthropic'))
