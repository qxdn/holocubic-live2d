import type { Context } from 'hono'
import { AppError, ErrorCodes } from '../core/errors/index.ts'
import { ensureTraceId } from '../middleware/request-context.ts'
import type { BaseResponse } from '../models/index.ts'
import { setTraceIdHeader } from './headers.ts'

/** 成功响应，HTTP 状态统一为 200。 */
export function success<T = null>(
  c: Context,
  data: T | null = null,
  message = 'success',
  total = 0,
) {
  const traceId = ensureTraceId(c)
  setTraceIdHeader(c, traceId)
  const body: BaseResponse<T> = {
    code: '0',
    traceId,
    success: true,
    message,
    total,
    data,
  }
  return c.json(body, 200)
}

/** AppError 使用业务错误信息，其余异常使用未知错误兜底。 */
export function fail(c: Context, error: Error) {
  const traceId = ensureTraceId(c)
  setTraceIdHeader(c, traceId)
  const body: BaseResponse<null> = {
    code:
      error instanceof AppError ? error.code : ErrorCodes.UNKNOWN_ERROR.code,
    traceId,
    success: false,
    message:
      error instanceof AppError ? error.message : ErrorCodes.UNKNOWN_ERROR.desc,
    data: null,
    total: 0,
  }
  return c.json(body, 200)
}
