import { anthropicHandler } from './anthropic.ts'
import { openAIHandler } from './openai.ts'
import type { Protocol } from './shared.ts'

export function aiHandler(protocol: Protocol) {
  switch (protocol) {
    case 'openai':
      return openAIHandler
    case 'anthropic':
      return anthropicHandler
  }
}
