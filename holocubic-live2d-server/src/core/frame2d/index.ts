import type { Live2dModel } from '../../models/live2d.ts'

const whaleMotions = {
  idle: '待机，呼吸和眨眼',
  eat: '捧碗吃饭，循环',
  putaway: '收起饭碗',
  bless: '祝福',
  wave: '挥手打招呼',
  heart: '比心',
  touchface: '摸脸思考，循环',
  'eat-mid': '吃饭动作',
  smug: '得意、傲娇',
  'subagent-in': '小鲸鱼入场',
  'subagent-loop': '小鲸鱼停留，循环',
  'subagent-out': '小鲸鱼离场',
}

/** 帧动画模型定义，以 modelId 索引，与角色注册 ID 独立。 */
export const frame2dModels = new Map<
  string,
  Pick<Live2dModel, 'name' | 'motions'>
>([
  [
    'deepseek-whale',
    {
      name: '鲸鱼娘',
      motions: Object.entries(whaleMotions).map(([name, desc]) => ({
        name,
        desc,
      })),
    },
  ],
])
