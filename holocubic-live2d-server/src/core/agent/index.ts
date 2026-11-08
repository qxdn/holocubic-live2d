import { testAgent, testAgentSpeech } from './test.ts'
import { registerCharacter } from '../character/registry.ts'

/** 注册聊天和语音共用的角色。 */
registerCharacter('testAgent', { agent: testAgent, speech: testAgentSpeech })
