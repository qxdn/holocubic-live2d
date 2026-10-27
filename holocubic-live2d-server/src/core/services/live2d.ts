import type {
  Live2dModel,
  Live2dModelPage,
  Live2dModelPageRequest,
} from '../../models/live2d.ts'

const models: Live2dModel[] = [
  {
    id: 'haru',
    name: 'Haru',
    url: '/models/Haru/Haru.model3.json',
    motions: [
      {
        name: 'haru_g_idle',
        group: 'Idle',
        index: 0,
        desc: '默认待机动作，用于角色空闲时的自然表现。',
      },
      {
        name: 'haru_g_m15',
        group: 'Idle',
        index: 1,
        desc: '备用待机动作，用于角色空闲时变化姿态。',
      },
      {
        name: 'haru_g_m26',
        group: 'TapBody',
        index: 0,
        desc: '身体触碰反应动作 m26；具体手势待确认。',
      },
      {
        name: 'haru_g_m06',
        group: 'TapBody',
        index: 1,
        desc: '身体触碰反应动作 m06；具体手势待确认。',
      },
      {
        name: 'haru_g_m20',
        group: 'TapBody',
        index: 2,
        desc: '身体触碰反应动作 m20；具体手势待确认。',
      },
      {
        name: 'haru_g_m09',
        group: 'TapBody',
        index: 3,
        desc: '身体触碰反应动作 m09；具体手势待确认。',
      },
    ],
  },
  {
    id: 'hiyori',
    name: 'Hiyori',
    url: '/models/Hiyori/Hiyori.model3.json',
    motions: [
      ...[1, 2, 3, 5, 6, 7, 8, 9, 10].map((number, index) => ({
        name: `Hiyori_m${String(number).padStart(2, '0')}`,
        group: 'Idle',
        index,
        desc: `Hiyori 待机动作 ${number}`,
      })),
      {
        name: 'Hiyori_m04',
        group: 'TapBody',
        index: 0,
        desc: 'Hiyori 身体触碰反应动作，具体手势待确认。',
      },
    ],
  },
]

/** 分页获取可用的 Live2D 模型。 */
export function pageLive2dModels(
  request: Live2dModelPageRequest,
): Live2dModelPage {
  const pageSize = request.getPageSize()
  const offset = request.current() * pageSize
  return {
    data: models.slice(offset, offset + pageSize),
    total: models.length,
  }
}

/** 按唯一 ID 获取模型信息，未找到时返回 null。 */
export function getLive2dModel(id: string): Live2dModel | null {
  return models.find((model) => model.id === id) ?? null
}
