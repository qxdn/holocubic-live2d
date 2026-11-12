import type { ServiceContext } from '../context.ts'
import type { Character } from '../character/index.ts'
import { getLive2dModel } from './live2d.ts'
import { frame2dModels } from '../frame2d/index.ts'

/** 两种渲染器共用动作名称协议，各自校验模型来源。 */
export async function getCharacterModel(
  context: ServiceContext,
  model: Character['model'],
) {
  switch (model.type) {
    case 'live2d':
      return getLive2dModel(context, model.modelId)
    case 'frame2d':
      return frame2dModels.get(model.modelId) ?? null
    default:
      return null
  }
}
