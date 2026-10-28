import type { DbConnection } from './sqlite/executor.ts'
import type { DbConfig } from '../../config/index.ts'
import { openSqliteDatabase } from './sqlite/index.ts'
import type { Repositories } from './repositories/index.ts'
import type { DbExecutor } from './sqlite/executor.ts'
import { AppError, ErrorCodes } from '../errors/index.ts'

/** 根据配置选择具体数据库实现。 */
export function openDatabase(config: DbConfig): {
  database: Database
  close: () => Promise<void>
} {
  switch (config.type) {
    case 'sqlite':
      return openSqliteDatabase(config)
    default:
      throw new AppError(
        ErrorCodes.DATABASE_TYPE_UNSUPPORTED,
        `不支持的数据库类型: ${config.type}`,
      )
  }
}

export type {
  Repositories,
  Live2dModelRepository,
  Live2dMotionRepository,
  Live2dModelRecord,
  Live2dMotionRecord,
} from './repositories/index.ts'
export type {
  DbConnection,
  DbTransaction,
  DbExecutor,
} from './sqlite/executor.ts'

/** 数据库能力，不持有请求或任务级业务上下文。 */
export interface Database {
  /** 普通数据库返回连接，事务数据库返回本次事务执行器。 */
  getExecutor(): DbExecutor
  /** 返回组装时注入的无状态 Repository 单例。 */
  getRepositories(): Repositories
  /** 委托当前 Drizzle 执行器开启事务或嵌套保存点；回调内使用传入的数据库对象。 */
  transaction<T>(work: (database: Database) => Promise<T>): Promise<T>
}

/** 由具体数据源实现，连接和事务执行器可使用不同类型。 */
export interface DatabaseAdapter {
  /** 非事务操作使用的 SQLite 连接。 */
  readonly connection: DbConnection
  /** 注入共享的无状态 Repository 实例。 */
  readonly repositories: Repositories
}

/** 共享 Repository 实例，事务期间只创建持有本次执行器的数据库对象。 */
export function createDatabase(adapter: DatabaseAdapter): Database {
  function createDatabaseContext(executor: DbExecutor): Database {
    const database: Database = {
      getExecutor: () => executor,
      getRepositories: () => adapter.repositories,
      async transaction(work) {
        return executor.transaction((transactionExecutor) =>
          work(createDatabaseContext(transactionExecutor)),
        )
      },
    }
    return database
  }
  return createDatabaseContext(adapter.connection)
}
