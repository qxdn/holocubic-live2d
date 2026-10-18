import { anthropicHandler } from './anthropic.js'
import { openAIHandler } from './openai.js'
import type { Protocol } from './shared.js'

export function aiHandler(protocol: Protocol) {
  switch (protocol) {
    case 'openai':
      return openAIHandler
    case 'anthropic':
      return anthropicHandler
  }
}
