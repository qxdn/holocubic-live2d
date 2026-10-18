import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { ModelMessage } from 'ai'
import { generateText, streamText } from 'ai'

// 流式和非流式调用共用的参数，由 handler 将外部协议转换为 AI SDK 格式。
export interface AIRequest {
  /** 上游模型 ID，直接传给配置的模型提供商。 */
  model: string
  /** 传给模型的消息列表，包含本次输入及所需的历史上下文。 */
  messages: ModelMessage[]
  /** 本次生成允许输出的最大 token 数，不是字符数。 */
  maxOutputTokens?: number
  /** 控制采样随机性，通常越低越稳定，支持范围取决于模型。 */
  temperature?: number
  /** 核采样概率阈值，用于限制候选 token 范围，通常与 temperature 二选一调整。 */
  topP?: number
  /** 停止字符串列表，生成时遇到匹配内容即停止，具体支持取决于上游。 */
  stopSequences?: string[]
  /** 取消信号，用于在客户端断开或请求取消时中止上游调用。 */
  abortSignal?: AbortSignal
}

// 根据环境配置选择上游提供商，模型 ID 直接传给上游。
function model(id: string) {
  const provider = process.env.AI_PROVIDER ?? 'openai'
  switch (provider) {
    case 'anthropic':
      return createAnthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
        baseURL: process.env.ANTHROPIC_BASE_URL,
      })(id)
    case 'openai':
      return createOpenAICompatible({
        name: 'upstream',
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
      }).chatModel(id)
    default:
      throw new Error('Invalid AI_PROVIDER')
  }
}

// 非流式：异步等待生成完成，通过 Promise 返回完整结果。
export function generateReply(request: AIRequest) {
  return generateText({
    ...request,
    model: model(request.model),
    maxRetries: 0, // 禁用 SDK 自动重试，让 handler 直接处理上游失败。
  })
}

// 流式：返回流结果，供 handler 持续读取并转换为对外协议的 SSE 事件。
export function streamReply(request: AIRequest) {
  return streamText({ ...request, model: model(request.model), maxRetries: 0 })
}
