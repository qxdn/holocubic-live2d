import type { ErrorCode } from './error-code.js'

/** 所有自定义业务异常的基类。内部异常细节请通过 cause 传入。 */
export class AppError extends Error {
  readonly code: string
  readonly desc: string

  constructor(errorCode: ErrorCode, message?: string | null, options?: ErrorOptions) {
    super(message || errorCode.desc, options)
    this.name = new.target.name
    this.code = errorCode.code
    this.desc = errorCode.desc
    Error.captureStackTrace(this, new.target)
  }
}
