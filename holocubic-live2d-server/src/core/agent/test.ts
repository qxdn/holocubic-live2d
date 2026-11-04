import type { ServiceContext } from '../context.ts'
import { Agent } from '@mastra/core/agent'
import { AnthropicProvider } from '../models/anthropic-provider.ts'
import { createModel } from './model.ts'
import { getTools, Live2dTool } from '../tools/index.ts'
import { getLive2dModel } from '../services/live2d.ts'
import { AppError, ErrorCodes } from '../errors/index.ts'
import type { AgentSpeechConfig } from './registry.ts'

/** 测试角色使用服务端配置的豆包 ASR 实例，语言由角色决定。 */
export const testAgentSpeech: AgentSpeechConfig = {
  asr: { provider: 'volcengine', language: 'zh-CN' },
}

/** 用于验证聊天和 UI message 流的简单 Agent。 */
export const testAgent = new Agent({
  id: 'test-agent',
  name: 'Test Agent',
  tools: async ({ requestContext }) => {
    const modelId = requestContext.get<'modelId', string>('modelId')
    const context = requestContext.get<'serviceContext', ServiceContext>(
      'serviceContext',
    )
    const model = await getLive2dModel(context, modelId)
    if (!model) throw new AppError(ErrorCodes.LIVE2D_MODEL_NOT_FOUND)
    const live2dTool = new Live2dTool(model)
    return {
      ...Object.fromEntries(
        getTools().map((tool) => [tool.getId(), tool.toMastraTool()]),
      ),
      [live2dTool.getId()]: live2dTool.toMastraTool(),
    }
  },
  instructions: '你是一个测试助手。请用简洁的中文回答用户的问题。',
  model: createModel(
    new AnthropicProvider({
      name: 'kimi',
      baseUrl: 'https://api.kimi.com/coding/v1',
      apiKey: process.env.OPENAI_API_KEY!,
    }),
    'kimi-k2.6',
  ),
})
