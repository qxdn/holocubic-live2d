import type { Live2dModelRepository, Live2dMotionRepository } from './live2d.ts'

/** 无状态 Repository 接口集合，执行器通过每次调用传入。 */
export interface Repositories {
  /** 模型记录的数据访问接口。 */
  readonly live2dModels: Live2dModelRepository
  /** 模型动作记录的数据访问接口。 */
  readonly live2dMotions: Live2dMotionRepository
}

export type { Live2dModelRepository, Live2dMotionRepository } from './live2d.ts'

export type { Live2dModelRecord, Live2dMotionRecord } from './records.ts'
