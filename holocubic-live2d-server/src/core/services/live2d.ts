import type { Live2dModelRecord, Live2dMotionRecord } from '../db/index.ts'
import type {
  Live2dModel,
  Live2dModelPage,
  Live2dModelPageRequest,
} from '../../models/live2d.ts'

import type { ServiceContext } from '../context.ts'

// -------------------- 私有函数 --------------------

/** 从数据库记录组装模型及动作名称、描述。 */
function toModel(
  record: Live2dModelRecord,
  motions: Live2dMotionRecord[],
): Live2dModel {
  return {
    id: record.id,
    name: record.name,
    url: record.url,
    motions: motions.map((motion) => ({
      name: motion.name,
      desc: motion.description,
    })),
  }
}

// -------------------- 对外导出 --------------------

/** 分页查询 Live2D 模型及其动作信息。 */
export async function pageLive2dModels(
  context: ServiceContext,
  request: Live2dModelPageRequest,
): Promise<Live2dModelPage> {
  // current() 将从 1 开始的页码转为从 0 开始的页索引，用于计算 SQL 偏移量。
  const options = {
    offset: request.current() * request.getPageSize(),
    limit: request.getPageSize(),
  }
  const repositories = context.getRepositories()
  const executor = context.getExecutor()
  // 查询当前页的模型；total 为所有模型的数量，不受分页限制。
  const records = await repositories.live2dModels.page(executor, options)
  const total = await repositories.live2dModels.count(executor, options)
  // 一次查出当前页所有模型的动作，避免每个模型各发起一次查询。
  // 空页传入空 ID 数组，Repository 直接返回空数组，不执行 SQL。
  const motions = await repositories.live2dMotions.findByModelIds(
    executor,
    records.map((record) => record.id),
  )
  // 在内存中按 modelId 分组，组装时直接查找，避免反复遍历全部动作。
  const motionsByModelId = new Map<string, Live2dMotionRecord[]>()
  for (const motion of motions) {
    const group = motionsByModelId.get(motion.modelId)
    if (group) group.push(motion)
    else motionsByModelId.set(motion.modelId, [motion])
  }
  // 保持模型分页查询的顺序，没有动作的模型返回 motions: []。
  const data = records.map((record) =>
    toModel(record, motionsByModelId.get(record.id) ?? []),
  )
  return { data, total }
}

/** 根据 ID 查询 Live2D 模型，不存在时返回 null。 */
export async function getLive2dModel(
  context: ServiceContext,
  id: string,
): Promise<Live2dModel | null> {
  const repositories = context.getRepositories()
  const executor = context.getExecutor()
  const record = await repositories.live2dModels.findById(executor, id)
  if (!record) return null
  const motions = await repositories.live2dMotions.findByModelId(
    executor,
    record.id,
  )
  return toModel(record, motions)
}
