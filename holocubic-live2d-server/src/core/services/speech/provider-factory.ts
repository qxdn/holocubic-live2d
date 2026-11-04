import { AppError, ErrorCodes } from '../../errors/index.ts'
import {
  VolcengineAsrProvider,
  type VolcengineAsrOptions,
} from './providers/volcengine.ts'
import type { AsrProvider } from './types.ts'

export type AsrProviderConfig = {
  readonly type: 'volcengine'
  readonly options: VolcengineAsrOptions
}

const providers = new Map<string, AsrProvider>()

/** 注册实例或根据配置创建实例，相同 type 会替换原实例。 */
export function register(type: string, provider: AsrProvider): void
export function register(config: AsrProviderConfig): void
export function register(
  ...args: [type: string, provider: AsrProvider] | [config: AsrProviderConfig]
): void {
  if (typeof args[0] === 'string') {
    providers.set(args[0], args[1]!)
    return
  }

  const config = args[0]
  switch (config.type) {
    case 'volcengine':
      register(config.type, new VolcengineAsrProvider(config.options))
      break
    default:
      throw new AppError(
        ErrorCodes.SPEECH_PROVIDER_CONFIG_INVALID,
        '不支持的语音识别供应商类型',
      )
  }
}

/** 根据配置初始化供应商。 */
export function initARS(config: AsrProviderConfig): void {
  register(config)
}

/** 按 type 获取已注册的同步 ASR 实例。 */
export function providerFactory(type: string): AsrProvider {
  const provider = providers.get(type)
  if (!provider) {
    throw new AppError(ErrorCodes.SPEECH_PROVIDER_NOT_FOUND)
  }
  return provider
}
