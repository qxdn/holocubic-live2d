import { z } from 'zod'

/** 统一业务返回结构，success / fail 工具函数均使用 HTTP 200。 */
export const baseResponseSchema = z.object({
  /** 业务状态码。 */
  code: z.string(),
  /** 请求追踪标识。 */
  traceId: z.string(),
  /** 请求是否成功。 */
  success: z.boolean(),
  message: z.string(),
  /** 无返回数据或请求失败时使用 null。 */
  data: z.unknown().nullable(),
})

export type BaseResponse<TData = unknown> = Omit<
  z.infer<typeof baseResponseSchema>,
  'data'
> & {
  data: TData | null
}
