import type { Live2dModel } from '../../models/live2d.ts'

/** 帧动画通过正文标签驱动客户端，不声明动作工具。 */
export function buildFrame2dPrompt(
  model: Pick<Live2dModel, 'name' | 'motions'>,
) {
  return [
    '【帧动画动作】',
    '需要动作时，在回复中写一个 <motion>动作名</motion>，例如 <motion>wave</motion>你好呀。',
    '每次回复最多一个动作标签，不需要动作时不写。标签外是给用户看的正文。',
    '动作只用以下名称，不要调用动作工具，不要写 [tool:...] 或其他模拟调用文本：',
    ...model.motions.map((motion) => `${motion.name}：${motion.desc}`),
  ].join('\n')
}
