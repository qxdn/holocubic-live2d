// 让生成的请求函数推导出解包后的类型，与实际返回值保持一致。
type BusinessData<T> = T extends { success: boolean; data: infer D } ? D : T

export class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.body = body
  }
}

export type ErrorType<T> = ApiError & { readonly body: T }

async function fetchResponse(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const headers = new Headers(options?.headers)
  if (!headers.has("Accept")) headers.set("Accept", "application/json")

  const baseURL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "")
  return fetch(`${baseURL}${url}`, {
    ...options,
    headers,
  })
}

// 统一解析 JSON 并检查 HTTP 状态；业务响应解包由 request 单独处理。
async function parseResponse(response: Response): Promise<unknown> {
  let body: unknown
  try {
    body = await response.json()
  } catch (error) {
    // 保留主动取消或读取中断的原始错误，只转换 JSON 解析错误。
    if (!(error instanceof SyntaxError)) throw error
    throw new ApiError("服务器返回了无效的 JSON", response.status, null)
  }
  if (response.ok) return body
  const result = body as {
    message?: string
    error?: { message?: string }
  } | null
  const message = result?.message || result?.error?.message
  throw new ApiError(
    typeof message === "string" ? message : `请求失败（${response.status}）`,
    response.status,
    body
  )
}

export async function request<T>(
  url: string,
  options?: RequestInit
): Promise<BusinessData<T>> {
  const response = await fetchResponse(url, options)
  const body = await parseResponse(response)

  // 普通业务接口使用后端统一响应结构；AI 和 SSE 不走此入口。
  const result = body as {
    code: string
    success: boolean
    data: unknown
    message: string
    traceId: string
  } | null
  if (!result?.success) {
    throw new ApiError(
      typeof result?.message === "string" && result.message
        ? result.message
        : `请求失败（${response.status}）`,
      response.status,
      body
    )
  }

  return result.data as BusinessData<T>
}
