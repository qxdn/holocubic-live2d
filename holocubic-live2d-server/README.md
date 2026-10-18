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

文档覆盖问候接口及 OpenAI / Anthropic 文本对话接口，包含请求、JSON 响应、
SSE 媒体类型和协议错误结构。稳定的 `operationId` 可供前端代码生成使用。
AI 请求 schema 复用现有 Zod 校验定义；新增接口时，在对应路由模块注册文档。
请求校验仍由现有 handler 处理，保留原有协议错误格式。

## 代码格式化

```powershell
pnpm format        # 自动格式化代码、配置和文档
pnpm format:check  # 检查格式，适合在 CI 中运行
```

Prettier 统一使用单引号、无分号、两空格缩进和 LF 换行。
忽略 `dist`、`node_modules`、`coverage` 和 `pnpm-lock.yaml`。
ESLint 负责代码检查，通过 `eslint-config-prettier` 关闭冲突的格式规则。
VS Code 可安装 Prettier 扩展（`esbenp.prettier-vscode`），将其设为默认格式化工具并开启保存时格式化。

## AI 协议接口

通过 Vercel AI SDK 接入上游，对外提供文本对话协议：

- OpenAI Chat Completions：`POST /api/v1/chat/completions`
- Anthropic Messages：`POST /api/v1/messages`

两个接口均支持非流式 JSON 和 `stream: true` 的 SSE，并可跨协议调用同一个上游。
这些接口使用原生协议响应和 HTTP 400/502 错误，不包装 `BaseResponse`。
已有 `/api` 业务接口保持原有返回约定。

复制 `.env.example` 后配置 `AI_PROVIDER=openai` 或 `anthropic`，以及对应的
`OPENAI_API_KEY` / `ANTHROPIC_API_KEY`。自定义兼容服务通过
`OPENAI_BASE_URL` / `ANTHROPIC_BASE_URL` 指定，包括 `/v1`，不要包括最终接口路径。
例如 Kimi Code 配合本项目的 AI SDK 应配置
`ANTHROPIC_BASE_URL=https://api.kimi.com/coding/v1`，SDK 会追加 `/messages`。
直接复制面向 Anthropic 官方 SDK 的 `/coding/` 地址会导致请求落到
`/coding/messages` 并返回 404。修改 `.env` 后需重启 `pnpm dev`。
请求中的 `model` 直接传给上游，不自动映射模型名称。
当前用于本地部署，不校验客户端访问密钥。上游密钥由服务端配置。

```powershell
pnpm build
node --env-file=.env dist/index.js
```

OpenAI 请求示例：

```json
{
  "model": "your-upstream-model",
  "messages": [{ "role": "user", "content": "你好" }],
  "max_completion_tokens": 256,
  "stream": false
}
```

Anthropic 请求体还必须包含 `max_tokens`，系统提示使用顶层 `system`。
支持字符串内容和 Anthropic 文本块数组，OpenAI 消息支持 system/user/assistant。
公共参数包括 `temperature`（0–1）、`top_p`；还支持 OpenAI `max_completion_tokens`、
`stop` 和 Anthropic `stop_sequences`。非流式响应包含 token 用量。
OpenAI 流以 `[DONE]` 结束；Anthropic 流包含 message_start、content_block_start/delta/stop、
message_delta 和 message_stop。上游流失败发送协议 error，不发送成功结束事件。
客户端断开会取消上游流。

当前为文本协议子集：工具调用、图片/音频、推理块、结构化输出、OpenAI Responses API、
模型列表和 token 计数接口尚未实现。未知请求字段会返回 400。
SDK 的通用结束原因将正常结束映射为 stop/end_turn，达到 token 限制映射为 length/max_tokens；
暂不还原具体命中的 stop_sequence。Anthropic 流开始时的 token 用量为 0，最终用量在
message_delta 中返回；OpenAI 流暂不返回 usage chunk。

`pnpm test` 使用本地模拟上游验证两种对外协议 × 两种上游协议 × JSON/SSE，
以及校验失败和原有路由。未使用真实模型密钥进行联网调用。
Provider 配置参考：[OpenAI compatible](https://ai-sdk.dev/providers/openai-compatible-providers)、
[Anthropic](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic)。

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

收到 SIGINT / SIGTERM 后先关闭 HTTP 服务，再刷新和关闭 SDK，完成后退出。

```powershell
pnpm test
```

测试启动本地模拟 OTLP 接收端和随机端口的服务，验证请求链路、上游 trace 继承、404、指标上报及敏感 URL 信息未被采集。服务端默认端口为 3000，可通过 `PORT` 修改。

## 请求上下文与异常

`requestContextMiddleware` 在 telemetry middleware 后注册，将当前 OTel trace ID 写入 `c.get('traceId')` 和响应头 `X-Trace-Id`。未启用 SDK 时生成 32 位十六进制请求标识。业务响应的 `traceId` 统一从上下文读取。

Hono 在内部捕获异常，因此统一异常处理使用 `app.onError(errorHandler)`。错误返回 `BaseResponse`，包含 `code`、`traceId`、`success`、`message`、`data`。捕获的异常统一返回 HTTP 200，响应体为 code="30001"、success=false、message="Internal Server Error"、data=null，并包含 traceId。服务端日志记录原始异常和 trace ID，活动 span 记录异常并标记 ERROR。普通 404 仍使用 Hono 默认响应，并附带 `X-Trace-Id`。

SDK 配置参考：[OpenTelemetry NodeSDK](https://github.com/open-telemetry/opentelemetry-js/blob/main/experimental/packages/opentelemetry-sdk-node/README.md)。

## 业务异常

首位分类约定：`1` 已知业务、`2` 外部错误、`3` 系统报错、`4` 未知。

错误码约定为五位数字字符串：第 1 位为大类，第 2–3 位为细类，第 4–5 位为序号。例如 `30001` = 系统报错 `3` + 通用 `00` + 内部错误 `01`。由开发者按约定定义，不做运行时格式校验。

自定义业务异常统一继承 `src/errors` 导出的 `AppError`。错误码实现 `ErrorCode` 接口，包含字符串 `code` 和 `desc`；`desc` 为可公开的描述，对应响应的 `message`。内部错误细节通过 `cause` 传入，仅用于日志排查。

```typescript
import { AppError, type ErrorCode } from './errors/index.js'

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
