import type { LibSQLDatabase } from 'drizzle-orm/libsql'

/** SQLite 数据库连接。 */
export type DbConnection = LibSQLDatabase

/** 从驱动的事务回调推导执行器，保持与连接类型一致。 */
export type DbTransaction = Parameters<
  Parameters<DbConnection['transaction']>[0]
>[0]

/** 普通查询传连接，事务查询传事务执行器。 */
export type DbExecutor = DbConnection | DbTransaction
