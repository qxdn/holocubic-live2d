/** 统一业务返回结构，success / fail 工具函数均使用 HTTP 200。 */
export interface BaseResponse<TData = unknown> {
  /** 业务状态码。 */
  code: string
  /** 请求追踪标识。 */
  traceId: string
  /** 请求是否成功。 */
  success: boolean
  message: string
  /** 无返回数据或请求失败时使用 null。 */
  data: TData | null
}
