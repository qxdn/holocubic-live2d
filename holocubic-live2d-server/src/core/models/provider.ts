export type ProviderProtocol = 'openai' | 'anthropic'

export interface ProviderOptions {
  /** 服务提供方的显示名称。 */
  name: string
  baseUrl: string
  apiKey: string
}

/** AI 服务提供方及其模型发现能力。 */
export abstract class Provider {
  /**
   * 服务提供方的名称，用于在 UI 中显示和区分不同服务。
   */
  name: string

  /**
   * 服务的 API 根地址，需包含版本路径，不包含具体资源路径。
   * 例如 https://api.openai.com/v1 或 https://api.anthropic.com/v1。
   * 获取模型列表时会在该地址后拼接 /models。
   */
  baseUrl: string

  /**
   * 服务提供方签发的 API 密钥，填写原始值，无需添加 Bearer 前缀。
   * 请求时根据协议放入 Authorization 或 x-api-key 请求头。
   */
  apiKey: string

  /**
   * 服务使用的 API 协议，决定请求鉴权方式和模型列表的分页处理。
   * openai 表示 OpenAI 兼容协议，anthropic 表示 Anthropic 兼容协议。
   */
  abstract readonly protocol: ProviderProtocol

  constructor({ name, baseUrl, apiKey }: ProviderOptions) {
    this.name = name
    this.baseUrl = baseUrl
    this.apiKey = apiKey
  }

  /** 获取服务提供方可用的全部模型 ID。 */
  abstract getModels(): Promise<string[]>
}
