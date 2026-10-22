import { AppError, ErrorCodes } from '../errors/index.ts'
import { Provider } from './provider.ts'

interface ModelsResponse {
  data: { id: string }[]
  has_more?: boolean
  last_id?: string
}

/** 使用 Anthropic 兼容协议的服务提供方。 */
export class AnthropicProvider extends Provider {
  /** 固定使用 Anthropic 兼容协议，由子类确定，无需传入。 */
  readonly protocol = 'anthropic'

  async getModels(): Promise<string[]> {
    const url = new URL(`${this.baseUrl.replace(/\/+$/, '')}/models`)
    const headers = {
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01',
    }
    const models: string[] = []

    while (true) {
      const response = await fetch(url, { headers })
      if (!response.ok) {
        throw new AppError(
          ErrorCodes.PROVIDER_MODELS_FETCH_FAILED,
          `Failed to fetch models: provider ${this.name} - HTTP ${response.status}`,
        )
      }

      const page = (await response.json()) as ModelsResponse
      models.push(...page.data.map(({ id }) => id))
      if (!page.has_more) {
        return models
      }

      if (!page.last_id || page.last_id === url.searchParams.get('after_id')) {
        throw new AppError(
          ErrorCodes.PROVIDER_MODELS_FETCH_FAILED,
          `Failed to fetch models: provider ${this.name} - pagination did not return a new cursor`,
        )
      }
      url.searchParams.set('after_id', page.last_id)
    }
  }
}
