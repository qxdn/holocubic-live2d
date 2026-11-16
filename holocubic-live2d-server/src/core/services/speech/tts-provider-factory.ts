import { AppError, ErrorCodes } from '../../errors/index.ts'
import {
  VolcengineTtsProvider,
  type VolcengineTtsOptions,
} from './providers/volcengine-tts.ts'
import type { TtsProvider } from './types.ts'
import {
  DeepseekTtsProvider,
  type DeepseekTtsOptions,
} from './providers/deepseek-tts.ts'

export type TtsProviderConfig =
  | {
      readonly type: 'volcengine'
      readonly options: VolcengineTtsOptions
    }
  | { readonly type: 'deepseek'; readonly options: DeepseekTtsOptions }

const providers = new Map<string, TtsProvider>()

/** 注册实例或根据配置创建实例，相同 type 会替换原实例。 */
export function registerTts(type: string, provider: TtsProvider): void
export function registerTts(config: TtsProviderConfig): void
export function registerTts(
  ...args: [type: string, provider: TtsProvider] | [config: TtsProviderConfig]
): void {
  if (typeof args[0] === 'string') {
    providers.set(args[0], args[1]!)
    return
  }
  const config = args[0]
  switch (config.type) {
    case 'deepseek':
      registerTts(config.type, new DeepseekTtsProvider(config.options))
      break
    case 'volcengine':
      registerTts(config.type, new VolcengineTtsProvider(config.options))
      break
    default:
      throw new AppError(ErrorCodes.TTS_PROVIDER_CONFIG_INVALID)
  }
}

export function initTTS(config: TtsProviderConfig): void {
  registerTts(config)
}

/** 按 type 获取已注册的 TTS 实例。 */
export function ttsProviderFactory(type: string): TtsProvider {
  const provider = providers.get(type)
  if (!provider) throw new AppError(ErrorCodes.TTS_PROVIDER_NOT_FOUND)
  return provider
}
