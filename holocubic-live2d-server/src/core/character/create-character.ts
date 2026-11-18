import { createAgent, type createModel } from '../agent/index.ts'
import { registerCharacter } from './registry.ts'
import { buildSystemPrompt } from './definition.ts'
import type { Character } from './definition.ts'

type CharacterDefinition = Omit<Character, 'agent'> & {
  readonly agentId?: string
  readonly name: string
  readonly agentModel: ReturnType<typeof createModel>
}

/** Builds, registers, and returns a complete Character from its definition. */
export function createCharacter({
  id,
  agentId = id,
  name,
  agentModel,
  model,
  speech,
  persona,
  worldBook,
  innerMonologue = true,
}: CharacterDefinition): Character {
  const systemPrompt = buildSystemPrompt({ persona, worldBook, innerMonologue })
  const agent = createAgent({
    id: agentId,
    name,
    instructions: systemPrompt,
    model: agentModel,
  })
  const character: Character = {
    id,
    agent,
    model,
    speech,
    persona,
    worldBook,
    innerMonologue,
  }
  registerCharacter(id, character)
  return character
}
