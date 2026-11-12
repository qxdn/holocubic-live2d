import type { ServiceContext } from '../context.ts'
import { Agent } from '@mastra/core/agent'
import type { createModel } from './model.ts'
import { getTools, Live2dTool } from '../tools/index.ts'
import { getCharacterModel } from '../services/character-model.ts'
import { getLive2dModel } from '../services/live2d.ts'
import { AppError, ErrorCodes } from '../errors/index.ts'
import { buildFrame2dPrompt } from './frame2d-prompt.ts'

/** 使用指定模型创建带有公共工具的 Agent。 */
export function createAgent({
  id,
  name,
  instructions,
  model,
}: {
  id: string
  name: string
  instructions: string
  model: ReturnType<typeof createModel>
}) {
  return new Agent({
    id,
    name,
    tools: async ({ requestContext }) => {
      const tools = Object.fromEntries(
        getTools().map((tool) => [tool.getId(), tool.toMastraTool()]),
      )
      if (requestContext.get('modelType') === 'frame2d') return tools
      const modelId = requestContext.get<'modelId', string>('modelId')
      const context = requestContext.get<'serviceContext', ServiceContext>(
        'serviceContext',
      )
      const model = await getLive2dModel(context, modelId)
      if (!model) throw new AppError(ErrorCodes.LIVE2D_MODEL_NOT_FOUND)
      const live2dTool = new Live2dTool(model)
      return {
        ...tools,
        [live2dTool.getId()]: live2dTool.toMastraTool(),
      }
    },
    instructions: async ({ requestContext }) => {
      if (requestContext.get('modelType') !== 'frame2d') return instructions
      const model = await getCharacterModel(
        requestContext.get('serviceContext'),
        {
          type: 'frame2d',
          modelId: requestContext.get('modelId'),
        },
      )
      if (!model) throw new AppError(ErrorCodes.LIVE2D_MODEL_NOT_FOUND)
      return `${instructions}\n\n${buildFrame2dPrompt(model)}`
    },
    model,
  })
}
