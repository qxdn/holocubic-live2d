import { z } from '@hono/zod-openapi'

// 非空字符串校验；不去除空白字符。
const text = z.string().min(1)
// 两种对外协议共用的请求字段。
const common = {
  /** 上游模型 ID，直接传给服务端配置的模型提供商。 */
  model: text,
  /** 是否使用 SSE 流式响应，省略时默认为 false。 */
  stream: z.boolean().optional().default(false),
  /** 采样温度；当前接口仅接受 0–1，实际支持情况取决于上游模型。 */
  temperature: z.number().min(0).max(1).optional(),
  /** 核采样概率阈值，范围为 0–1，通常与 temperature 二选一调整。 */
  top_p: z.number().min(0).max(1).optional(),
}

/** OpenAI Chat Completions 文本请求；strict 拒绝未声明的字段。 */
export const openAIRequestSchema = z
  .object({
    ...common,
    /** 至少一条消息，支持系统提示、用户输入和助手历史回复。 */
    messages: z
      .array(
        z
          .object({
            role: z.enum(['system', 'user', 'assistant']),
            /** 当前仅支持非空文本，不接受图片、音频等内容块。 */
            content: text,
          })
          .strict(),
      )
      .min(1),
    /** 生成 token 总数上限，包含可见回复和推理 token。 */
    max_completion_tokens: z.number().int().positive().optional(),
    /** 停止字符串，可提供单个字符串或最多四个字符串。 */
    stop: z.union([text, z.array(text).max(4)]).optional(),
  })
  .strict()

/** Anthropic Messages 文本请求；系统提示使用顶层 system 字段。 */
export const anthropicRequestSchema = z
  .object({
    ...common,
    /** 至少一条用户或助手消息；消息及内容块均拒绝未知字段。 */
    messages: z
      .array(
        z
          .object({
            role: z.enum(['user', 'assistant']),
            /** 支持非空文本，或至少包含一个元素的文本块数组。 */
            content: z.union([
              text,
              z
                .array(z.object({ type: z.literal('text'), text }).strict())
                .min(1),
            ]),
          })
          .strict(),
      )
      .min(1),
    /** 可选系统提示，支持字符串或文本块数组。 */
    system: z
      .union([
        text,
        z.array(z.object({ type: z.literal('text'), text }).strict()).min(1),
      ])
      .optional(),
    /** 必填的输出 token 数上限，必须为正整数。 */
    max_tokens: z.number().int().positive(),
    /** 可选停止字符串列表，具体停止行为由上游处理。 */
    stop_sequences: z.array(text).optional(),
  })
  .strict()

/** 校验后的 OpenAI 请求类型，包含 stream 的默认值。 */
export type OpenAIRequest = z.infer<typeof openAIRequestSchema>
/** 校验后的 Anthropic 请求类型，与 schema 保持同步。 */
export type AnthropicRequest = z.infer<typeof anthropicRequestSchema>

const tokens = z.number().int().nonnegative()

export const openAIResponseSchema = z
  .object({
    id: z.string(),
    object: z.literal('chat.completion'),
    created: z.number().int(),
    model: z.string(),
    choices: z.array(
      z.object({
        index: z.number().int(),
        message: z.object({
          role: z.literal('assistant'),
          content: z.string(),
        }),
        finish_reason: z.enum(['stop', 'length']),
      }),
    ),
    usage: z.object({
      prompt_tokens: tokens,
      completion_tokens: tokens,
      total_tokens: tokens,
    }),
  })
  .openapi('ChatCompletion')

export const anthropicResponseSchema = z
  .object({
    id: z.string(),
    type: z.literal('message'),
    role: z.literal('assistant'),
    model: z.string(),
    content: z.array(z.object({ type: z.literal('text'), text: z.string() })),
    stop_reason: z.enum(['end_turn', 'max_tokens']),
    stop_sequence: z.null(),
    usage: z.object({ input_tokens: tokens, output_tokens: tokens }),
  })
  .openapi('Message')

export function protocolErrorSchema(protocol: 'openai' | 'anthropic') {
  const error = z.object({
    type: z.enum(['invalid_request_error', 'api_error']),
    message: z.string(),
  })
  return protocol === 'openai'
    ? z
        .object({ error: error.extend({ param: z.null(), code: z.null() }) })
        .openapi('OpenAIError')
    : z.object({ type: z.literal('error'), error }).openapi('AnthropicError')
}
