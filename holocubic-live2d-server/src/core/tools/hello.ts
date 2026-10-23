import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

/** 用于验证聊天中工具调用和结果展示的无副作用工具。 */
export const helloTool = createTool({
  id: 'hello',
  description: '向指定名字打招呼。用户要求测试 hello 工具时调用此工具。',
  inputSchema: z.object({ name: z.string().describe('打招呼的对象名字') }),
  outputSchema: z.object({ message: z.string() }),
  execute: ({ name }) => Promise.resolve({ message: `Hello, ${name}!` }),
})
