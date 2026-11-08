import type { Character } from './index.ts'
import { mastra } from '../mastra/index.ts'
import { AppError } from '../errors/app-error.ts'
import { ErrorCodes } from '../errors/error-code.ts'

/** 聊天和语音共用的角色注册表，以注册 ID 索引角色定义。 */
const characters = new Map<string, Character>()

export function registerCharacter(
  characterId: string,
  character: Omit<Character, 'id'>,
): void {
  mastra.addAgent(character.agent, characterId)
  characters.set(characterId, { ...character, id: characterId })
}

/** 按注册 ID 获取角色；未知 ID 不回退到其他 Agent。 */
export function getCharacter(characterId: string): Character {
  const character = characters.get(characterId)
  if (!character) throw new AppError(ErrorCodes.AGENT_NOT_FOUND)
  return character
}
