import { Agent } from '@mastra/core/agent'
import { AnthropicProvider } from '../models/anthropic-provider.ts'
import { createModel } from './model.ts'

/** 用于验证聊天和 UI message 流的简单 Agent。 */
export const testAgent = new Agent({
  id: 'test-agent',
  name: 'Test Agent',
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
