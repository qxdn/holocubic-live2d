import type { Repositories } from './db/repositories/index.ts'
import type { Database } from './db/index.ts'
import type { DbExecutor } from './db/sqlite/executor.ts'

/** 每次请求或任务独立创建，跨 service 显式传递当次上下文。 */
export interface ServiceContext {
  /** 当前上下文使用的普通数据库或事务数据库。 */
  readonly database: Database
  /** 获取当前普通连接或事务执行器。 */
  getExecutor(): DbExecutor
  /** 获取共享的无状态 Repository。 */
  getRepositories(): Repositories
  /** 使用 Drizzle 事务语义，保留当次上下文字段并替换数据库。 */
  transaction<T>(work: (context: ServiceContext) => Promise<T>): Promise<T>
}

export function createServiceContext(database: Database): ServiceContext {
  return {
    database,
    getExecutor() {
      return this.database.getExecutor()
    },
    getRepositories() {
      return this.database.getRepositories()
    },
    transaction(work) {
      return this.database.transaction((database) =>
        work({ ...this, database }),
      )
    },
  }
}
