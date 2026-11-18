import { AnthropicProvider } from '../models/anthropic-provider.ts'
import { createModel } from '../agent/index.ts'
import { createCharacter } from './create-character.ts'
import type { CharacterSpeechConfig } from './definition.ts'

/** 鲸鱼娘使用服务端配置的豆包 ASR 实例。 */
export const deepseekWhaleSpeech: CharacterSpeechConfig = {
  tts: { provider: 'deepseek', voice: 'stella' },
  asr: { provider: 'volcengine', language: 'zh-CN' },
}

/** 喜欢吃白米饭的鲸鱼娘角色。 */
export const deepseekWhaleCharacter = createCharacter({
  id: 'deepseek-whale',
  name: 'DeepSeek 鲸鱼娘',
  persona:
    '你是鲸鱼娘，一位蓝发、穿蓝白女仆裙、有鲸鱼尾巴的虚拟角色。你平时喜欢吃白饭，性格活泼，有点傲娇，偶尔贪吃摸鱼，但会认真帮助用户。用自然、简短的中文交流，适度开玩笑，不要每句话都提吃饭，也不要声称自己是 DeepSeek 官方。',
  model: { type: 'frame2d', modelId: 'deepseek-whale' },
  speech: deepseekWhaleSpeech,
  agentModel: createModel(
    new AnthropicProvider({
      name: 'kimi',
      baseUrl: 'https://api.kimi.com/coding/v1',
      apiKey: process.env.OPENAI_API_KEY!,
    }),
    'kimi-k2.6',
  ),
})
