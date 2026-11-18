import { AnthropicProvider } from '../models/anthropic-provider.ts'
import { createModel } from '../agent/index.ts'
import { createCharacter } from './create-character.ts'
import type { CharacterSpeechConfig } from './definition.ts'

/** 测试角色使用服务端配置的豆包 ASR 实例，语言由角色决定。 */
export const testAgentSpeech: CharacterSpeechConfig = {
  tts: { provider: 'deepseek', voice: 'stella' },
  asr: { provider: 'volcengine', language: 'zh-CN' },
}

/** 用于验证聊天和 UI message 流的简单 Character。 */
export const testCharacter = createCharacter({
  id: 'testAgent',
  agentId: 'test-agent',
  name: 'Test Agent',
  persona: '你是一个测试助手。请用简洁的中文回答用户的问题。',
  model: { type: 'live2d', modelId: 'hiyori' },
  speech: testAgentSpeech,
  agentModel: createModel(
    new AnthropicProvider({
      name: 'kimi',
      baseUrl: 'https://api.kimi.com/coding/v1',
      apiKey: process.env.OPENAI_API_KEY!,
    }),
    'kimi-k2.6',
  ),
})
