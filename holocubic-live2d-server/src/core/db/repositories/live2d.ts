import type { Live2dModelRecord, Live2dMotionRecord } from './records.ts'
import type { DbExecutor } from '../sqlite/executor.ts'

/** 无状态模型数据访问接口，每次调用显式传入当前执行器。 */
export interface Live2dModelRepository {
  /** 按模型唯一标识查询，记录不存在时返回 null。 */
  findById(executor: DbExecutor, id: string): Promise<Live2dModelRecord | null>
  /** 按 id 升序分页查询，只返回当前页的模型记录。 */
  page(
    executor: DbExecutor,
    options: {
      /** 跳过的记录数，从 0 开始。 */
      offset: number
      /** 当前页最多返回的记录数。 */
      limit: number
    },
  ): Promise<Live2dModelRecord[]>
  /** 返回总记录数；参数与 page 一致，计数不受 offset 和 limit 限制。 */
  count(
    executor: DbExecutor,
    options: {
      /** 与 page 保持一致的分页偏移量，不参与计数。 */
      offset: number
      /** 与 page 保持一致的分页大小，不参与计数。 */
      limit: number
    },
  ): Promise<number>
}

/** 动作数据访问接口；通过 modelId 与模型逻辑关联。 */
export interface Live2dMotionRepository {
  /** 查询指定模型的所有动作，无匹配记录时返回空数组。 */
  findByModelId(
    executor: DbExecutor,
    modelId: string,
  ): Promise<Live2dMotionRecord[]>
  /** 批量查询指定模型的动作，模型 ID 为空时返回空数组。 */
  findByModelIds(
    executor: DbExecutor,
    modelIds: string[],
  ): Promise<Live2dMotionRecord[]>
}
