import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import type { DbConfig } from '../../../config/index.ts'
import { createDatabase } from '../index.ts'
import { sqliteRepositories } from './repositories.ts'

/** 只建立连接，不自动建表或填充业务数据。 */
export function openSqliteDatabase(config: DbConfig) {
  const client = createClient({ url: config.url })
  const connection = drizzle(client)
  const database = createDatabase({
    connection,
    repositories: sqliteRepositories,
  })
  return {
    database,
    close: () =>
      new Promise<void>((resolve) => {
        client.close()
        resolve()
      }),
  }
}
