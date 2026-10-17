import { Hono } from 'hono'
import { rootHandler } from '../handlers/root.js'

export const greetingRoutes = new Hono()

greetingRoutes.get('/', rootHandler)
