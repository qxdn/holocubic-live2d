# 聊天流中的双向 TTS

## 配置与工厂

服务端必须配置 `speech.tts`，结构见 `holocubic-live2d-server/config/config.example.json`。`initTTS(config)` 初始化，`registerTts(...)` 注册或替换实例，`ttsProviderFactory(type)` 获取实例。API Key 只保存在服务端。

火山使用 `wss://openspeech.bytedance.com/api/v3/tts/bidirection`，默认资源为 `seed-tts-2.0`。角色通过 `speech.tts.provider` 和 `speech.tts.voice` 指定供应商及音色。账号需开通同项目下的语音合成 2.0 和相应音色权限。

通用接口 `TtsProvider.openSession({ voice, signal? }, callbacks)` 返回 `sendText`、`finish`、`cancel`。`onAudio` 返回 24 kHz、单声道、有符号 16-bit 小端 PCM，不含 WAV 文件头；`onDone` 确认供应商成功结束，`onError` 报告失败。

每轮回复一个合成会话，支持持续提交文本，无须客户端分句。连接/会话建立等待 15 秒，输入或音频空闲超时 60 秒；火山单轮最长 5 分钟，DeepSeek 单轮最长 30 分钟。

## DeepSeek TTS

服务端 `speech.tts` 可选择 DeepSeek，完整配置见 `holocubic-live2d-server/config/config.example.json`。在本机忽略提交的 `config/config.json` 中填写：

```json
{
  "type": "deepseek",
  "options": {
    "apiKey": "your-deepseek-api-key",
    "endpoint": "wss://api.deepseek.com/v1/tools/tts"
  }
}
```

这是 `speech.tts` 的值，其余 ASR、数据库等配置继续使用现有值。对应角色的 `speech.tts` 设为 `{ provider: 'deepseek', voice: 'stella' }`；`stella` 是女声，`tide` 是男声；角色的 `voice` 必填，服务端 provider 配置不需要填写音色。当前初始化配置选择一个 TTS provider，因此启用该 provider 的角色必须选用与它对应的音色。默认示例、鲸鱼娘和 testAgent 已选择 DeepSeek，两个角色均显式指定 `voice: stella`。在本机配置中填写真实 DeepSeek Key 后才能调用合成服务；ASR 仍使用火山。

`DeepseekTtsProvider` 通过 Authorization 请求头鉴权，以 WebSocket 持续发送 `text` 事件，结束输入时发送 `finish_text`；二进制音频直接交给现有 24 kHz PCM SSE 分支。仅收到 `finish` 且 `code=success` 才确认成功，提前断开、厂商错误及无效 PCM 均按失败处理。取消请求会关闭上游连接。Web 和 Lua 播放协议不变。

文本限制由 DeepSeek 服务端执行：每会话最多 10,000 个计费字符、64 KiB 文本，60 秒没有文字会结束输入；SDK 自动响应服务端 WebSocket ping。账号额度、音色和真实合成需用实际 Key 联调。

当前仓库尚未提供 DeepSeek TTS 的独立协议测试；真实合成效果需使用实际 Key 联调。

官方协议：https://api-docs.deepseek.com/zh-cn/guides/tts/

## 原有聊天接口附加音频

继续使用 `POST /api/chat`，通过 `enableTts` 开启本轮语音合成（默认 `false`）：

```json
{
  "characterId": "deepseek-whale",
  "enableTts": true,
  "messages": [
    {"id":"user-1","role":"user","parts":[{"type":"text","text":"你好"}]}
  ]
}
```

服务端沿用原有 Agent 调用和 AI SDK UI message SSE 流。角色配置了 TTS 时，`addSpeechToStream` 包装原有流：聊天事件继续下发，正文增量过滤后送入同一个 TTS 会话，供应商的 onAudio 回调向原流追加音频事件。

```text
data: {"type":"text-delta","id":"text-1","delta":"你好呀！"}

data: {"type":"data-audio","data":{"audio":"<Base64 PCM>","format":"pcm_s16le","sampleRate":24000,"channels":1},"transient":true}

data: {"type":"data-audio-end","data":{},"transient":true}

data: {"type":"finish","finishReason":"stop"}

data: [DONE]
```

文字与音频事件会交错，不保证逐帧或逐字对应。音频通过 Base64 在 SSE 中传输；客户端解码后按顺序缓冲播放。音频事件为 transient，不追加到 AI SDK 聊天历史。reasoning、工具事件和原始正文继续保留；只有正文增量送入语音分支。

`data-audio-end` 表示合成输出结束，不代表设备本地播放结束。原 finish 事件在音频完成后才发送，随后流关闭。取消 HTTP 请求/响应会取消 LLM 和 TTS；异常发送原有 error 事件，不发送成功 finish。

`enableTts` 为 `false` 或省略时返回原有文字流；为 `true` 但角色未配置 `speech.tts` 时，在启动聊天流前返回 `10204`（角色未配置语音合成）。

Web 和 Lua 都可以消费此 SSE 协议，无须收到文字后再调用 TTS。旧的 `/api/chat/voice` WebSocket 方案已移除。

Web StoryBook 中的“TTS → 朗读”开关默认关闭，开启后发送消息或重新生成会附带 `enableTts: true`，通过 Web Audio 按顺序播放 PCM。停止生成、新对话、重新生成、关闭朗读和页面卸载会清理本地播放队列；合成结束事件不会截断尚未播放完的音频。音频上下文在发送或重新生成的用户交互中启用。Lua 客户端已通过 /api/chat SSE 接入 PCM 播放，持续接收音频并在内存中排队，不再按队列时长暂停 HTTP 接收或在 256 KiB 时中断；请求期间暂停麦克风，队列播放和 DMA 排空后恢复采集。固件接口模拟测试已通过，真实设备播放仍需验证。

## 标签过滤

过滤器跨分块保存状态，隐藏 think、motion、script、style 标签及其内部内容，移除其他标签但保留正文。未闭合标签和隐藏内容在结束时丢弃；数学比较符号（如 `1 < 2`）保留。原始文字事件不修改，方便客户端处理角色动作。Markdown 和 Emoji 过滤由火山合成参数启用。

正常聊天只需调用 `/api/chat`，不提供客户端单独调用的 TTS 接口。

官方协议：https://docs.volcengine.com/docs/doubao-voice/bidirectional-streaming-text-to-speech-websocket?lang=zh
