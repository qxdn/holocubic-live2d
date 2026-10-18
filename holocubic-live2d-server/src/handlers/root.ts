import type { Handler } from 'hono'
import { getGreeting } from '../services/greeting.ts'
import { success } from '../utils/index.ts'

export const rootHandler: Handler = (c) => {
  const greeting = getGreeting()
  return success(c, { greeting })
}
