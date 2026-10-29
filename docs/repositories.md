# Repository 与 ServiceContext

ServiceContext 是每次请求或定时任务独立创建的业务上下文，后续可增加当次调用的用户信息、任务标识等字段。Database 是其中的 database 属性，不继承 ServiceContext，也不持有业务上下文。

- `src/core/context.ts`：ServiceContext 与创建函数。
- `src/core/db/index.ts`：Database、DatabaseAdapter 与数据库组装。
- `src/core/db/repositories`：记录类型与 Repository 接口。
- `src/core/db/sqlite/repositories.ts`：显式 SQL 实现和无状态单例 sqliteRepositories。
- `src/middleware/request-context.ts`：每次 HTTP 请求创建 ServiceContext，注入共享的普通 Database。
- `docs/schema.sql`：建表 SQL，不会在启动时自动执行。

普通请求共用数据库对象和 Repository 实例，但不共用 ServiceContext。定时任务在任务入口通过 createServiceContext(database) 创建自己的 context。

```ts
const context = createServiceContext(database)
const repositories = context.getRepositories()
const executor = context.getExecutor()
const model = await repositories.live2dModels.findById(executor, modelId)
```

Repository 不保存连接或事务状态，每次调用显式传入当前执行器。子 service 只使用传入的 context，不导入具体 SQLite 实现，不从全局获取数据库。

ServiceContext 的 getExecutor、getRepositories 委托当前 database，transaction 则复制当次上下文字段、替换事务数据库后传给回调。便捷方法按 context.method() 调用。

## 事务传播

Database.transaction(work) 直接调用当前 Drizzle 执行器的 transaction：普通连接上开启事务，事务执行器上创建嵌套保存点。回调返回的对象是 Database，不是 ServiceContext。

```ts
await context.database.transaction(async (database) => {
  // 保留当次请求或任务的其他字段，只替换数据库依赖；不修改原 context。
  const transactionContext = { ...context, database }
  await serviceA(transactionContext)
  await database.transaction(async (nestedDatabase) => {
    // 使用 Drizzle 的嵌套保存点，仍属于外层事务。
    await serviceB({ ...transactionContext, database: nestedDatabase })
  })
})
```

使用 context 的便捷入口可以省去手动复制上下文：

```ts
await context.transaction(async (transactionContext) => {
  await serviceA(transactionContext)
  await transactionContext.transaction(async (nestedContext) => {
    await serviceB(nestedContext)
  })
})
```

事务数据库对象保存本次事务执行器，Repository 单例继续复用。原 context 的普通数据库不会被替换。子 service 只需参与当前事务时，直接传 transactionContext，不再次调用 transaction。需要局部回滚时才使用嵌套事务：内层失败回滚到保存点，外层捕获错误后可以继续；错误继续向外传播则外层也回滚。内层成功不代表独立提交，外层回滚仍会撤销内层操作。

提交、回滚和事务资源管理交给 Drizzle 及其驱动。所有数据库操作必须被等待，事务数据库及其 context 只能在回调期间使用。SQLite 并发事务受连接和写锁限制，相关错误直接传播。

模型与动作通过 modelId 逻辑关联，不创建外键。服务端动作只返回 name、desc，播放位置由客户端解析。
