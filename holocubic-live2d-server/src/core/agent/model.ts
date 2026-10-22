import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { Provider } from '../models/provider.ts'

/** 根据服务提供方的协议和配置创建指定模型。 */
export const createModel = (provider: Provider, model: string) => {
  const options = {
    name: provider.name,
    baseURL: provider.baseUrl,
    apiKey: provider.apiKey,
  }

  switch (provider.protocol) {
    case 'openai':
      return createOpenAICompatible(options).chatModel(model)
    case 'anthropic':
      return createAnthropic(options)(model)
  }
}
