import { testAgent, testAgentSpeech } from './test.ts'
import { registerAgent } from './registry.ts'

/** 注册聊天和语音共用的角色。 */
registerAgent('testAgent', { agent: testAgent, speech: testAgentSpeech })
