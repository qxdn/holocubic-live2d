# 语音识别接口

服务端通用接口与火山引擎实现，由 `holocubic-live2d-server/src/core/services/speech/index.ts` 导出。

```ts
interface AsrProvider {
  transcribe(audio: AsrAudio, options: AsrOptions): Promise<AsrResult>
}
```

每次调用提交完整音频，等待识别完成后返回 `{ text: string }`，失败时 Promise 拒绝。
这里的同步表示一次请求等待最终结果，仍使用 Promise，不阻塞 JavaScript 线程。

- `AsrAudio.data`：完整音频字节，使用 Uint8Array。
- 音频格式：16 kHz、单声道、有符号 16-bit 小端 PCM，不包含 WAV 文件头。
- `AsrOptions.language`：BCP 47 语言标签，例如 zh-CN，由调用方从 Agent 配置中取得。
- `AsrResult.text`：最终完整文本。

当前提供 `VolcengineAsrProvider` 厂商实现，入口通过 `initARS(config)` 创建并注册实例，handler 按 Agent 的 `speech.asr.provider` 调用 `providerFactory(provider)` 获取实例。
也可通过 `register(type, provider)` 注册实例，相同 type 会替换原实例；获取未注册的 type 会抛出 `SPEECH_PROVIDER_NOT_FOUND`。
`GET /api/speech/stream` 不再注册。
识别结果如何提交给聊天接口由调用方决定。

## 对外 HTTP 接口

`POST /api/speech/asr?agentId=testAgent`

请求头为 `Content-Type: application/octet-stream`，请求体为上述完整裸 PCM 字节。
`agentId` 必填，识别语言取自该 Agent 的 `speech.asr.language`，供应商由 `speech.asr.provider` 指定；供应商凭据使用服务端 `speech.asr` 配置。

```sh
curl -X POST 'http://localhost:3000/api/speech/asr?agentId=testAgent' \
  -H 'Content-Type: application/octet-stream' \
  --data-binary '@recording.pcm'
```

成功返回统一响应：

```json
{"code":"0","success":true,"message":"success","traceId":"...","total":0,"data":{"text":"你好"}}
```

静音时 `data.text` 可以为空字符串。业务失败沿用 HTTP 200，返回 `success: false` 和 `data: null`，调用方需检查 `success`。
空音频、奇数字节或缺少 agentId 返回 `10001`（ILLEGAL_PARAM）；未知 Agent 返回 `10301`；
Agent 未配置 ASR 返回 `10202`；服务端未配置供应商返回 `30301`。供应商错误由统一异常处理返回。
接口只检查 PCM 字节对齐，调用方需确保实际采样格式正确。

在服务端目录运行 `node --import tsx --test test/speech-api.test.mjs` 验证 HTTP 契约，测试使用模拟供应商。

## 火山引擎同步识别

使用一句话识别（流式输入模式），需开通 `volc.seedasr.sauc.duration`，使用豆包语音 API Key。
官方协议：https://docs.volcengine.com/docs/doubao-voice/unidirectional-streaming-automatic-speech-recognition-websocket?lang=zh

从 speech/index.ts 导入 `VolcengineAsrProvider`，使用 `new VolcengineAsrProvider({ apiKey })` 创建，再调用上述 `transcribe(audio, { language: 'zh-CN' })`。
适配器每次调用建立独立 WebSocket，先发送音频配置，再以 200 ms（6400 字节）为一包发送 gzip 压缩的裸 PCM。请求序号从 1 递增，最后一包序号取负值并携带结束标志。等待服务端最终结果后关闭连接并返回文字，不将中间结果返回给调用方。前端仍然调用 HTTP 接口，无需对象存储。

识别负载中的 `result` 是对象（与输出示例一致）。排查用的 `logId` 从握手响应头 `X-Tt-Logid` 读取，缺失时保留空字符串；握手成功后通过项目 logger 记录，握手失败时也读取并附在错误信息中。Python 示例中的 `code`、`event`、`is_last_package` 和 `payload_msg` 是协议解析器的输出结构，其中 `payload_msg` 对应解压、反序列化后的负载，不是线上 JSON 外层。

构造参数 resourceId 默认 `volc.seedasr.sauc.duration`，endpoint 默认 `wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_nostream`。内部固定 60 秒超时，包含连接、音频发送和等待结果的时间，不提供超时配置项。当前整段录音上传后还会按音频时长发送到供应商，适用于短语音输入；较长录音可能触发超时。
配置示例见 holocubic-live2d-server/config/config.example.json。使用旧极速版配置的环境需要替换 endpoint 和 resourceId。
静音状态 20000003 返回空文本；握手失败、厂商错误、无效响应及未收到最终结果便断开均抛出 AppError，超时使用 SPEECH_TIMEOUT。

协议测试：在服务端目录运行 `node --import tsx --test test/volcengine-asr.test.mjs`。测试使用模拟响应，不代表真实供应商联调成功。
