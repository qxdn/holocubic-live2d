import { z } from '@hono/zod-openapi'
import type { BaseRequest } from './request.ts'

export const pageRequestSchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().default(20),
  })
  .openapi('PageRequest')

/** 公共分页请求，页码从 1 开始；具体查询请求继承此类。 */
export class PageRequest implements BaseRequest {
  page = 1
  pageSize = 20

  constructor(input: z.input<typeof pageRequestSchema> = {}) {
    const request = pageRequestSchema.parse(input)
    this.page = request.page
    this.pageSize = request.pageSize
  }

  current(): number {
    return this.page - 1
  }

  getPageSize(): number {
    return this.pageSize
  }
}
