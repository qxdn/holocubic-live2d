import type { Handler } from 'hono'
import { getLive2dModel, pageLive2dModels } from '../core/services/live2d.ts'
import { getServiceContext } from '../middleware/request-context.ts'
import { Live2dModelPageRequest } from '../models/live2d.ts'
import { success } from '../utils/index.ts'

/** 分页返回可用的 Live2D 模型。 */
export const pageLive2dModelsHandler: Handler = async (c) => {
  const request = new Live2dModelPageRequest(c.req.query())
  const { total, data } = await pageLive2dModels(
    getServiceContext(c),
    request,
  )
  return success(c, data, 'success', total)
}

/** 返回指定 ID 对应的 Live2D 模型。 */
export const getLive2dModelHandler: Handler = async (c) => {
  return success(
    c,
    await getLive2dModel(getServiceContext(c), c.req.param('id')!),
  )
}
