/**
 * 五位数字字符串：第 1 位大类，第 2–3 位细类，第 4–5 位序号。
 * 大类约定：1 已知业务，2 外部错误，3 系统报错，4 未知。
 */
export interface ErrorCode {
  readonly code: string
  readonly desc: string
}

/** desc 会作为响应 message 返回客户端。 */
function defineErrorCode(code: string, desc: string): ErrorCode {
  return Object.freeze({ code, desc })
}

/** 通用错误码。各业务模块可按 ErrorCode 接口扩展自己的错误码。 */
export const ErrorCodes = {
  // 2：外部错误；01：服务提供方；01：获取模型列表失败。
  PROVIDER_MODELS_FETCH_FAILED: defineErrorCode('20101', '获取模型列表失败'),
  // 4：未知错误；00：通用；01：未知错误。
  UNKNOWN_ERROR: defineErrorCode('40001', '未知错误'),
} as const satisfies Record<string, ErrorCode>
