import { createTool, noopObserve } from '@mastra/core/tools'
import type {
  ToolExecuteContext,
  ToolExecutionContext,
} from '@mastra/core/tools'
import type { z } from 'zod'
import { AppError, ErrorCodes } from '../errors/index.ts'

/** 客户端工具继承此类，只声明元信息，不提供服务端执行方法。 */
export class ToolDefinition<Input = void, Output = unknown> {
  /** 默认使用类名；稳定的工具 ID 可由子类覆盖。 */
  getId(): string {
    return this.constructor.name
  }

  getDescription(): string {
    return ''
  }

  getExecution(): 'server' | 'client' {
    return 'server'
  }

  /** 客户端工具也可重写此方法，向模型声明所需参数。 */
  protected getInputSchema(): z.ZodType<Input> | undefined {
    return undefined
  }

  /** 输出校验可选；需要时由具体工具提供。 */
  protected getOutputSchema(): z.ZodType<Output> | undefined {
    return undefined
  }

  protected getExecutor():
    | ((
        input: Input,
        context: ToolExecuteContext<ToolExecutionContext>,
      ) => Promise<Output>)
    | undefined {
    return undefined
  }

  toMastraTool() {
    const id = this.getId()
    const description = this.getDescription()
    const execution = this.getExecution()
    const execute = this.getExecutor()
    if (execution === 'server' && !execute) {
      throw new AppError(
        ErrorCodes.TOOL_SERVER_EXECUTOR_MISSING,
        `${id} 服务端工具必须继承 BaseTool`,
      )
    }
    if (execution === 'client' && execute) {
      throw new AppError(
        ErrorCodes.TOOL_CLIENT_EXECUTOR_UNEXPECTED,
        `${id} 客户端工具应继承 ToolDefinition`,
      )
    }
    return createTool({
      id,
      description,
      inputSchema: this.getInputSchema(),
      outputSchema: this.getOutputSchema(),
      execute,
    })
  }
}

/** 实例只保存共享依赖，调用信息通过 Mastra 原生上下文传递。 */
export abstract class BaseTool<
  Input = void,
  Output = unknown,
> extends ToolDefinition<Input, Output> {
  /** 服务端工具必须声明参数 Schema，无参数时可返回 z.object({})。 */
  protected abstract override getInputSchema(): z.ZodType<Input>

  /** 执行前调用；抛错时停止执行，未重写时跳过。支持异步处理。 */
  protected beforeExecute?(
    input: Input,
    context: ToolExecuteContext<ToolExecutionContext>,
  ): void | Promise<void>

  /** execute 成功返回后调用；不替换结果，抛错时整次调用按失败处理。 */
  protected afterExecute?(
    input: Input,
    result: Output,
    context: ToolExecuteContext<ToolExecutionContext>,
  ): void | Promise<void>

  protected abstract execute(
    input: Input,
    context: ToolExecuteContext<ToolExecutionContext>,
  ): Output | Promise<Output>

  protected override getExecutor() {
    const id = this.getId()
    return async (
      input: Input,
      context: ToolExecuteContext<ToolExecutionContext>,
    ): Promise<Output> => {
      const startedAt = performance.now()
      // 当前 Mastra 直接调用 tool.execute 时可能未注入 observe。
      const observe = context.observe ?? noopObserve
      const fields = {
        toolId: id,
        toolCallId: context.agent?.toolCallId,
        traceId: context.requestContext.get('traceId'),
      }
      observe.log('info', 'Tool started', fields)
      try {
        await this.beforeExecute?.(input, context)
        const result = await this.execute(input, context)
        await this.afterExecute?.(input, result, context)
        observe.log('info', 'Tool completed', {
          ...fields,
          durationMs: performance.now() - startedAt,
        })
        return result
      } catch (error) {
        observe.log('error', 'Tool failed', {
          ...fields,
          durationMs: performance.now() - startedAt,
          ...(error instanceof AppError ? { code: error.code } : {}),
          error,
        })
        throw error
      }
    }
  }
}
