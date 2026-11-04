import type { Agent } from '@mastra/core/agent'
import { mastra } from '../mastra/index.ts'
import { AppError } from '../errors/app-error.ts'
import { ErrorCodes } from '../errors/error-code.ts'

/** Agent 指定供应商和识别语言；供应商凭据由服务端配置。 */
export interface AgentSpeechConfig {
  readonly asr?: {
    readonly provider: string
    readonly language: string
  }
}

/** 应用层角色定义，聊天和语音共享同一个注册 ID。 */
export interface AgentDefinition {
  readonly id: string
  readonly agent: Agent
  readonly speech?: AgentSpeechConfig
}

/** 聊天和语音共用的角色注册表，以注册 ID 索引角色定义。 */
const agentDefinitions = new Map<string, AgentDefinition>()

export function registerAgent(
  agentId: string,
  definition: Omit<AgentDefinition, 'id'>,
): void {
  mastra.addAgent(definition.agent, agentId)
  agentDefinitions.set(agentId, { ...definition, id: agentId })
}

/** 按注册 ID 获取角色；未知 ID 不回退到其他 Agent。 */
export function getAgentDefinition(agentId: string): AgentDefinition {
  const definition = agentDefinitions.get(agentId)
  if (!definition) throw new AppError(ErrorCodes.AGENT_NOT_FOUND)
  return definition
}
