import { sql } from 'drizzle-orm'
import type {
  Live2dModelRecord,
  Live2dModelRepository,
  Live2dMotionRecord,
  Live2dMotionRepository,
  Repositories,
} from '../repositories/index.ts'
import type { DbExecutor } from './executor.ts'

type ModelRow = Omit<Live2dModelRecord, 'createdAt' | 'updatedAt'> & {
  createdAt: number
  updatedAt: number
}

type MotionRow = Omit<Live2dMotionRecord, 'createdAt' | 'updatedAt'> & {
  createdAt: number
  updatedAt: number
}

function toRecord<T extends { createdAt: number; updatedAt: number }>(row: T) {
  return {
    ...row,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  }
}

/** SQLite 模型查询实现，不保存连接或事务状态。 */
export class SqliteLive2dModelRepository implements Live2dModelRepository {
  async findById(executor: DbExecutor, id: string) {
    const [row] = await executor.all<ModelRow>(sql`
      SELECT id, name, url, created_at AS createdAt, updated_at AS updatedAt
      FROM live2d_models WHERE id = ${id}
    `)
    return row ? toRecord(row) : null
  }

  async page(executor: DbExecutor, options: { offset: number; limit: number }) {
    const rows = await executor.all<ModelRow>(sql`
      SELECT id, name, url, created_at AS createdAt, updated_at AS updatedAt
      FROM live2d_models ORDER BY id ASC
      LIMIT ${options.limit} OFFSET ${options.offset}
    `)
    return rows.map(toRecord)
  }

  async count(
    executor: DbExecutor,
    // 与 page 保持相同签名，分页参数不参与总数查询。
    _options: { offset: number; limit: number },
  ) {
    void _options
    const row = await executor.get<{ total: number }>(sql`
      SELECT COUNT(*) AS total FROM live2d_models
    `)
    return row.total
  }
}

/** SQLite 动作查询实现，不保存连接或事务状态。 */
export class SqliteLive2dMotionRepository implements Live2dMotionRepository {
  async findByModelId(executor: DbExecutor, modelId: string) {
    const rows = await executor.all<MotionRow>(sql`
      SELECT id, model_id AS modelId, name, description,
             created_at AS createdAt, updated_at AS updatedAt
      FROM live2d_motions WHERE model_id = ${modelId} ORDER BY id ASC
    `)
    return rows.map(toRecord)
  }

  async findByModelIds(executor: DbExecutor, modelIds: string[]) {
    if (modelIds.length === 0) return []
    const ids = sql.join(
      modelIds.map((id) => sql`${id}`),
      sql`, `,
    )
    const rows = await executor.all<MotionRow>(sql`
      SELECT id, model_id AS modelId, name, description,
             created_at AS createdAt, updated_at AS updatedAt
      FROM live2d_motions WHERE model_id IN (${ids}) ORDER BY id ASC
    `)
    return rows.map(toRecord)
  }
}

/** 组装时注入一次，普通连接和所有事务复用同一组无状态实例。 */
export const sqliteRepositories: Repositories = {
  live2dModels: new SqliteLive2dModelRepository(),
  live2dMotions: new SqliteLive2dMotionRepository(),
}
