/** 统一业务返回结构。HTTP 状态码由接口单独设置。 */
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
