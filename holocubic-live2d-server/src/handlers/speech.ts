import type { Handler } from 'hono'
import type { AppEnv } from '../env.ts'
import { getAgentDefinition } from '../core/agent/registry.ts'
import { AppError, ErrorCodes } from '../core/errors/index.ts'
import { providerFactory } from '../core/services/speech/index.ts'
import { asrQuerySchema } from '../models/speech.ts'
import { success } from '../utils/index.ts'

/** 提交完整 PCM 音频，使用 Agent 的语言配置识别。 */
export const asrHandler: Handler<AppEnv> = async (c) => {
  const { agentId } = asrQuerySchema.parse(c.req.query())
  const options = getAgentDefinition(agentId).speech?.asr
  if (!options) throw new AppError(ErrorCodes.AGENT_ASR_NOT_CONFIGURED)
  const provider = providerFactory(options.provider)

  const data = new Uint8Array(await c.req.arrayBuffer())
  if (data.length === 0 || data.length % 2 !== 0) {
    throw new AppError(
      ErrorCodes.ILLEGAL_PARAM,
      'PCM 音频不能为空，且字节数必须为偶数',
    )
  }
  const result = await provider.transcribe(
    { data, format: 'pcm', sampleRate: 16000, bits: 16, channels: 1 },
    { language: options.language },
  )
  return success(c, result)
}
