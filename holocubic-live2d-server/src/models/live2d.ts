import { z } from '@hono/zod-openapi'
import { baseResponseSchema } from './response.ts'
import { PageRequest, pageRequestSchema } from './page-request.ts'

/** 模型支持的动作，group 和 index 对应模型入口文件中的动作位置。 */
export const live2dMotionSchema = z
  .object({
    name: z.string(),
    group: z.string(),
    index: z.number().int().nonnegative(),
    desc: z.string(),
  })
  .openapi('Live2dMotion')

/** Live2D 模型信息及其可播放动作；id 唯一，url 指向模型入口文件。 */
export const live2dModelSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    url: z.string(),
    motions: z.array(live2dMotionSchema),
  })
  .openapi('Live2dModel')

export type Live2dModel = z.infer<typeof live2dModelSchema>

export const live2dModelPageRequestSchema = pageRequestSchema
  .extend({})
  .openapi('Live2dModelPageRequest')

export class Live2dModelPageRequest extends PageRequest {}

export const live2dModelPageResponseSchema = baseResponseSchema
  .extend({
    data: z.array(live2dModelSchema),
  })
  .openapi('Live2dModelPageResponse')

export type Live2dModelPage = Pick<
  z.infer<typeof live2dModelPageResponseSchema>,
  'data' | 'total'
>

export const live2dModelResponseSchema = baseResponseSchema
  .extend({ data: live2dModelSchema.nullable() })
  .openapi('Live2dModelResponse')
