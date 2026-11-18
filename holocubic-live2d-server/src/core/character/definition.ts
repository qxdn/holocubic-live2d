import type { Agent } from '@mastra/core/agent'

/** 角色指定语音供应商、识别语言和合成音色；凭据由服务端配置。 */
export interface CharacterSpeechConfig {
  readonly tts?: {
    readonly provider: string
    readonly voice: string
  }
  readonly asr?: {
    readonly provider: string
    readonly language: string
  }
}

/** 应用层角色定义，聊天和语音共享同一个注册 ID。 */
export interface Character {
  readonly id: string
  readonly agent: Agent
  readonly model: {
    readonly type: 'live2d' | 'frame2d'
    readonly modelId: string
  }
  readonly speech?: CharacterSpeechConfig
  /** 角色身份、性格和说话方式。 */
  readonly persona?: string
  /** 角色所在世界的背景设定。 */
  readonly worldBook?: string
  /** 是否在系统提示词中加入角色内心独白规则。 */
  readonly innerMonologue?: boolean
}

/** 组装角色提示词；工具定义仍由 Agent 单独提供。 */
export function buildSystemPrompt(
  character: Pick<Character, 'persona' | 'worldBook' | 'innerMonologue'>,
): string {
  const sections: string[] = []
  const persona = character.persona?.trim()
  const worldBook = character.worldBook?.trim()

  if (persona) sections.push(`【角色设定】\n${persona}`)
  if (worldBook) sections.push(`【世界书】\n${worldBook}`)
  if (character.innerMonologue) {
    sections.push(
      '【内心独白】\n在大多数回复中，用 <think>...</think> 包裹角色的内心想法、心理活动或动作；标签外写角色对用户说的话。内心和动作可以用简短的斜体描述，例如：<think>*低下头，脸颊微微泛红*</think>这件事说起来真让人不好意思…… 或 <think>*心里暗自得意：居然真的解决了这个难题*</think>这个嘛，只是修好了一个小问题而已。独白应符合角色口吻，不写模型推理过程。',
    )
  }

  return sections.join('\n\n')
}
