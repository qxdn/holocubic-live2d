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
  ILLEGAL_PARAM: defineErrorCode('10001', '请求参数不合法'),
  // 1：已知业务；01：Live2D；01：模型不存在。
  LIVE2D_MODEL_NOT_FOUND: defineErrorCode('10101', 'Live2D 模型不存在'),
  SPEECH_PROTOCOL_INVALID: defineErrorCode('10201', '语音识别协议错误'),
  AGENT_ASR_NOT_CONFIGURED: defineErrorCode('10202', 'Agent 未配置语音识别'),
  SPEECH_QUEUE_FULL: defineErrorCode('10203', '语音识别队列已满'),
  AGENT_NOT_FOUND: defineErrorCode('10301', 'Agent 不存在'),
  // 2：外部错误；01：服务提供方；01：获取模型列表失败。
  PROVIDER_MODELS_FETCH_FAILED: defineErrorCode('20101', '获取模型列表失败'),
  SPEECH_PROVIDER_FAILED: defineErrorCode('20201', '语音识别服务失败'),
  SPEECH_TIMEOUT: defineErrorCode('20202', '语音识别服务超时'),
  // 3：系统报错；01：工具配置。
  TOOL_SERVER_EXECUTOR_MISSING: defineErrorCode(
    '30104',
    '服务端工具缺少执行方法',
  ),
  // 3：系统报错；02：数据库配置；01：不支持的数据库类型。
  DATABASE_TYPE_UNSUPPORTED: defineErrorCode('30201', '不支持的数据库类型'),
  SPEECH_PROVIDER_NOT_FOUND: defineErrorCode('30301', '语音识别供应商未配置'),
  SPEECH_PROVIDER_CONFIG_INVALID: defineErrorCode(
    '30302',
    '语音识别供应商配置无效',
  ),
  // 4：未知错误；00：通用；01：未知错误。
  UNKNOWN_ERROR: defineErrorCode('40001', '未知错误'),
} as const satisfies Record<string, ErrorCode>
