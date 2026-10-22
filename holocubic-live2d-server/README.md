# HoloCubic Live2D Server

```powershell
pnpm install
pnpm dev
```

API: `http://localhost:3000/api`.

## OpenAPI 文档

在后端目录运行以下命令，直接生成 `openapi.json`，无需启动服务或配置 `.env`：

```powershell
pnpm openapi:generate
```

文档覆盖 Hono 业务接口，直接从路由注册信息导出。Mastra 原生接口不包含在该文件中，
不额外提供 OpenAPI HTTP 端点。

## 代码格式化

```powershell
pnpm format        # 自动格式化代码、配置和文档
pnpm format:check  # 检查格式，适合在 CI 中运行
```

Prettier 统一使用单引号、无分号、两空格缩进和 LF 换行。
忽略 `dist`、`node_modules`、`coverage` 和 `pnpm-lock.yaml`。
ESLint 负责代码检查，通过 `eslint-config-prettier` 关闭冲突的格式规则。
VS Code 可安装 Prettier 扩展（`esbenp.prettier-vscode`），将其设为默认格式化工具并开启保存时格式化。

## Mastra

通过官方 `@mastra/hono` 适配器将 Mastra 接入现有 Hono 服务，继续使用
`pnpm dev` / `pnpm build` / `pnpm start` 启动和构建。
`src/core/mastra/index.ts` 导出统一 Mastra 实例；服务在适配器初始化完成后开始监听。

Mastra 原生接口使用默认 `/api` 前缀，例如 `GET /api/agents`。
当前未注册 Agent，列表为空，无需模型密钥；聊天能力后续接入，模型将在 Agent 代码中配置。
本次未配置工具、记忆、存储、工作流、后台 workers 或 Studio。
Mastra 接口使用原生响应，现有业务接口保留统一响应约定和 HTTP 遥测。

旧的 `/api/v1/chat/completions` 和 `/api/v1/messages` 已移除，
不保留旧协议、参数或配置兼容层。前端暂不接入聊天接口。
收到 SIGINT / SIGTERM 后关闭 HTTP 服务、Mastra 和遥测。

`pnpm test` 验证无模型配置启动、业务路由、Mastra 空 Agent 列表、旧接口移除和正常退出，
不包含模型联网调用。

参考：[Mastra Hono 适配器](https://mastra.ai/reference/server/hono-adapter)。

## 类型检查

在 `holocubic-live2d-server` 目录运行：

```powershell
pnpm typecheck  # 仅检查 TypeScript 类型，不生成 dist
```

## 代码检查

在 `holocubic-live2d-server` 目录运行：

```powershell
pnpm lint      # 检查代码，任何警告或错误都会使命令失败
pnpm lint:fix  # 自动修复可修复的问题，其余问题仍需手动处理
```

ESLint 使用 flat config：JavaScript 使用推荐规则，`src` 下的 TypeScript
使用 typescript-eslint 的 `recommendedTypeChecked`，包含未处理 Promise 等类型规则。
检查覆盖源码、JavaScript 测试和配置文件，忽略 `dist`、`coverage` 和 `node_modules`。
格式沿用现有代码风格，未添加格式化规则。

按 TypeScript 官方并存方案，`@typescript/native` 别名提供 TypeScript 7 的 `tsc`，
构建和类型检查仍使用 TS 7；`typescript` 别名指向 `@typescript/typescript6`，
为 typescript-eslint 提供兼容的 TS 6 API。
参考：[TypeScript 6/7 并存说明](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6.0)。

## OpenTelemetry

服务端记录 HTTP server spans 和 `http.server.request.duration` 耗时直方图（秒），支持 W3C `traceparent` / `tracestate` 上下文传播。路由使用模板聚合；不采集请求体、请求头、查询参数或未匹配 URL。5xx 标记为错误。当前未接入日志上报和下游自动埋点。

SDK 在应用初始化前启动，通过 OTLP HTTP/JSON 上报，默认接收端为 `http://localhost:4318`。需要单独运行支持该协议的 Collector 或观测后端；本项目不包含后端部署。

```powershell
$env:OTEL_SERVICE_NAME = 'holocubic-live2d-server'
$env:OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4318'
pnpm dev
```

配置示例见 `.env.example`。环境变量直接传给进程，应用不会自动加载 `.env`。也可在构建后使用 Node 加载配置：

```powershell
Copy-Item .env.example .env
pnpm build
node --env-file=.env dist/index.js
```

- `OTEL_EXPORTER_OTLP_ENDPOINT` 为基础地址，自动追加 `/v1/traces` 和 `/v1/metrics`。
- `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` / `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` 可分别指定完整信号地址。
- `OTEL_EXPORTER_OTLP_HEADERS` 配置上报认证头，请勿提交真实凭据。
- `OTEL_RESOURCE_ATTRIBUTES` 配置环境等资源属性。
- 指标使用 SDK 默认配置：每 60 秒上报，上报超时为 30 秒。
- `OTEL_TRACES_SAMPLER` / `OTEL_TRACES_SAMPLER_ARG` 配置采样策略。
- `OTEL_SDK_DISABLED=true` 关闭采集。

收到 SIGINT / SIGTERM 后先关闭 HTTP 服务和 Mastra，再刷新和关闭 SDK，完成后退出。

```powershell
pnpm test
```

服务端默认端口为 3000，可通过 `PORT` 修改。HTTP 遥测配置沿用现有实现。

## 请求上下文与异常

`requestContextMiddleware` 在 telemetry middleware 后注册，将当前 OTel trace ID 写入 `c.get('traceId')` 和响应头 `X-Trace-Id`。未启用 SDK 时生成 32 位十六进制请求标识。业务响应的 `traceId` 统一从上下文读取。

Hono 在内部捕获异常，因此统一异常处理使用 `app.onError(errorHandler)`。错误返回 `BaseResponse`，包含 `code`、`traceId`、`success`、`message`、`data`。捕获的异常统一返回 HTTP 200，响应体为 code="30001"、success=false、message="Internal Server Error"、data=null，并包含 traceId。服务端日志记录原始异常和 trace ID，活动 span 记录异常并标记 ERROR。普通 404 仍使用 Hono 默认响应，并附带 `X-Trace-Id`。

SDK 配置参考：[OpenTelemetry NodeSDK](https://github.com/open-telemetry/opentelemetry-js/blob/main/experimental/packages/opentelemetry-sdk-node/README.md)。

## 业务异常

首位分类约定：`1` 已知业务、`2` 外部错误、`3` 系统报错、`4` 未知。

错误码约定为五位数字字符串：第 1 位为大类，第 2–3 位为细类，第 4–5 位为序号。例如 `30001` = 系统报错 `3` + 通用 `00` + 内部错误 `01`。由开发者按约定定义，不做运行时格式校验。

自定义业务异常统一继承 `src/core/errors` 导出的 `AppError`。错误码实现 `ErrorCode` 接口，包含字符串 `code` 和 `desc`；`desc` 为可公开的描述，对应响应的 `message`。内部错误细节通过 `cause` 传入，仅用于日志排查。

```typescript
import { AppError, type ErrorCode } from './core/errors/index.js'

const DEVICE_NOT_FOUND = {
  code: '10101',
  desc: 'Device not found',
} as const satisfies ErrorCode

class DeviceNotFoundError extends AppError {
  constructor(message?: string | null, options?: ErrorOptions) {
    super(DEVICE_NOT_FOUND, message, options)
  }
}

throw new DeviceNotFoundError()

// message 省略、null 或空字符串时，默认使用 errorCode.desc。
// 包装异常时通过 cause 保留原始异常和 stack，可以多层传递。
try {
  // 调用下游服务
} catch (cause) {
  throw new DeviceNotFoundError('指定设备不存在', { cause })
}
```

捕获 `AppError` 时返回其 `code` 和最终的 `message`；其余异常使用 `ErrorCodes.UNKNOWN_ERROR` 兜底。HTTP 状态均为 200，`success=false`，携带 traceId。`error.stack` 表示当前抛出位置，`error.cause` 保留原始异常及其 stack；服务端日志会输出 cause 链，响应不暴露 stack。
