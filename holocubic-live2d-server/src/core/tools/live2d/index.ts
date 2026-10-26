import { z } from 'zod'
import { BaseTool } from '../base-tool.ts'
import { registerTool } from '../tool-store.ts'

const inputSchema = z.object({
  name: z
    .enum([
      'haru_g_idle',
      'haru_g_m15',
      'haru_g_m26',
      'haru_g_m06',
      'haru_g_m20',
      'haru_g_m09',
    ])
    .describe(
      '动作名称：haru_g_idle 为默认待机，haru_g_m15 为备用待机；haru_g_m26、haru_g_m06、haru_g_m20、haru_g_m09 为身体触碰反应，具体手势尚未确认。',
    ),
})

/** 仅声明客户端动作工具，由前端调用 Live2DHandle.playMotion(name)。 */
export class Live2dTool extends BaseTool<z.infer<typeof inputSchema>, boolean> {
  override getId() {
    return 'live2d_motion'
  }

  override getDescription() {
    return '让前端 Live2D 角色播放指定动作。返回值表示是否成功开始播放，不代表播放结束。'
  }

  override getExecution() {
    return 'client' as const
  }

  protected override getInputSchema() {
    return inputSchema
  }

  protected override getOutputSchema() {
    return z.boolean()
  }
}

export const live2dTool = new Live2dTool()
registerTool(live2dTool)
