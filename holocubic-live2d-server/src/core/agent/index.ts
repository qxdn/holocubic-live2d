import { testAgent, testAgentSpeech } from './test.ts'
import { deepseekWhaleAgent, deepseekWhaleSpeech } from './deepseek-whale.ts'
import { registerCharacter } from '../character/registry.ts'

/** 注册聊天和语音共用的角色。 */
registerCharacter('testAgent', {
  agent: testAgent,
  model: { type: 'live2d', modelId: 'hiyori' },
  speech: testAgentSpeech,
})

registerCharacter('deepseek-whale', {
  agent: deepseekWhaleAgent,
  model: { type: 'frame2d', modelId: 'deepseek-whale' },
  speech: deepseekWhaleSpeech,
})
