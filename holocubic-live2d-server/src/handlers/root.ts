import type { Handler } from 'hono'
import { getGreeting } from '../services/greeting.js'
import { success } from '../utils/index.js'

export const rootHandler: Handler = (c) => {
  const greeting = getGreeting()
  return success(c, { greeting })
}
