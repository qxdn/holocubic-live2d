import type { Handler } from 'hono'
import { getLive2dModel } from '../core/services/live2d.ts'
import { success } from '../utils/index.ts'

/** 返回指定 ID 对应的 Live2D 模型。 */
export const getLive2dModelHandler: Handler = (c) => {
  return success(c, getLive2dModel(c.req.param('id')!))
}
