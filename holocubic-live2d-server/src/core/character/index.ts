import type { Agent } from '@mastra/core/agent'

/** 角色指定供应商和识别语言；供应商凭据由服务端配置。 */
export interface CharacterSpeechConfig {
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
    readonly type: 'live2d'
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
      '【内心独白】\n在适合表现角色心理时，可以用 <think>...</think> 写一句简短的内心想法或情绪。标签之外的文字是对用户说的话，不必每次回复都包含独白。',
    )
  }

  return sections.join('\n\n')
}
