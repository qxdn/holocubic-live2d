import { randomUUID } from 'node:crypto'
import type { Handler } from 'hono'
import type { BaseResponse } from '../models/index.js'
import { getGreeting } from '../services/greeting.js'

export const rootHandler: Handler = (c) => {
  const greeting = getGreeting()
  const response: BaseResponse<{ greeting: string }> = {
    code: '0',
    traceId: randomUUID(),
    success: true,
    message: 'success',
    data: { greeting }
  }
  return c.json(response)
}
