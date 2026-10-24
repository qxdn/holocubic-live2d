import { z } from 'zod'
import { BaseTool } from '../base-tool.ts'
import { registerTool } from '../tool-store.ts'

/** 用于验证聊天中工具调用和结果展示的无副作用工具。 */
export class HelloTool extends BaseTool<{ name: string }, { message: string }> {
  protected getInputSchema() {
    return z.object({ name: z.string().describe('打招呼的对象名字') })
  }

  protected getOutputSchema() {
    return z.object({ message: z.string() })
  }

  protected execute({ name }: { name: string }) {
    return { message: `Hello, ${name}!` }
  }
}

export const helloTool = new HelloTool()
registerTool(helloTool)
