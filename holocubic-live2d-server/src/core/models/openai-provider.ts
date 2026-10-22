import { AppError, ErrorCodes } from '../errors/index.ts'
import { Provider } from './provider.ts'

interface ModelsResponse {
  data: { id: string }[]
}

/** 使用 OpenAI 兼容协议的服务提供方。 */
export class OpenAIProvider extends Provider {
  /** 固定使用 OpenAI 兼容协议，由子类确定，无需传入。 */
  readonly protocol = 'openai'

  async getModels(): Promise<string[]> {
    const url = new URL(`${this.baseUrl.replace(/\/+$/, '')}/models`)
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    })
    if (!response.ok) {
      throw new AppError(
        ErrorCodes.PROVIDER_MODELS_FETCH_FAILED,
        `Failed to fetch models: provider ${this.name} - HTTP ${response.status}`,
      )
    }

    const page = (await response.json()) as ModelsResponse
    return page.data.map(({ id }) => id)
  }
}
