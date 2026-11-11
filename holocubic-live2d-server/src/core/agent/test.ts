import { AnthropicProvider } from '../models/anthropic-provider.ts'
import { createModel } from './model.ts'
import { createAgent } from './create-agent.ts'
import type { CharacterSpeechConfig } from '../character/index.ts'

/** 测试角色使用服务端配置的豆包 ASR 实例，语言由角色决定。 */
export const testAgentSpeech: CharacterSpeechConfig = {
  asr: { provider: 'volcengine', language: 'zh-CN' },
}

/** 用于验证聊天和 UI message 流的简单 Agent。 */
export const testAgent = createAgent({
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
