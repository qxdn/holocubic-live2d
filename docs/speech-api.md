# 语音识别接口

当前仅定义服务端通用接口，由 `holocubic-live2d-server/src/core/services/speech/index.ts` 导出。

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

流式会话、Realtime 消息类型、WebSocket 路由、豆包适配器和运行时工厂已移除。
当前没有 ASR HTTP 接口或厂商实现，`GET /api/speech/stream` 不再注册。
Agent 语言配置与服务端供应商配置暂时保留，后续实现同步识别时再接线。
识别结果如何提交给聊天接口由调用方决定。
