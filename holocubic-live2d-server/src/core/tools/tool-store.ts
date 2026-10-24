import type { BaseTool } from './base-tool.ts'

const tools = new Map<string, BaseTool<unknown, unknown>>()

/** 仅保存调用方创建的实例；构造参数和依赖由工具定义处负责。 */
export function registerTool<Input, Output>(instance: BaseTool<Input, Output>) {
  // 不同工具的泛型在存储边界统一擦除，保存的仍是原实例。
  tools.set(instance.getId(), instance as unknown as BaseTool<unknown, unknown>)
}

/** 按 getId() 获取共享实例；模块尚未导入或 ID 不存在时返回 undefined。 */
export function getTool(id: string): BaseTool<unknown, unknown> | undefined {
  return tools.get(id)
}

/** 获取已加载工具的实例列表，便于遍历并转换为 Mastra 工具。 */
export function getTools(): BaseTool<unknown, unknown>[] {
  return Array.from(tools.values())
}
