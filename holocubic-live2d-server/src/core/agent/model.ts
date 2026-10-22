import {
  createAnthropic,
  type AnthropicProviderSettings,
} from '@ai-sdk/anthropic'
import {
  createOpenAICompatible,
  type OpenAICompatibleProviderSettings,
} from '@ai-sdk/openai-compatible'

type ModelArguments =
  | [
      protocol: 'openai',
      modelId: string,
      options: OpenAICompatibleProviderSettings,
    ]
  | [protocol: 'anthropic', modelId: string, options: AnthropicProviderSettings]

/** 根据协议创建模型，options 使用对应适配器的原生配置。 */
export const createModel = (
  ...[protocol, modelId, options]: ModelArguments
) => {
  switch (protocol) {
    case 'openai':
      return createOpenAICompatible(options).chatModel(modelId)
    case 'anthropic':
      return createAnthropic(options)(modelId)
  }
}
