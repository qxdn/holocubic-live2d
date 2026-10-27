import { z } from 'zod'
import { BaseTool } from '../base-tool.ts'
import type { Live2dModel } from '../../../models/live2d.ts'

/** 仅声明客户端动作工具，由前端调用 Live2DHandle.playMotion(name)。 */
export class Live2dTool extends BaseTool<{ name: string }, boolean> {
  constructor(private readonly model: Live2dModel) {
    super()
  }

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
    return z.object({
      name: z
        .enum(this.model.motions.map((motion) => motion.name))
        .describe(
          `当前模型为 ${this.model.name}，不会自动切换模型。\n${this.model.motions
            .map((motion) => `${motion.name}：${motion.desc}`)
            .join('\n')}`,
        ),
    })
  }

  protected override getOutputSchema() {
    return z.boolean()
  }
}
