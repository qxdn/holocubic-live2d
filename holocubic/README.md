# HoloCubic Chat

将 `live2d/` 内所有文件复制到设备 SD 卡的 `/sd/apps/live2d/`，在 Launcher 中重新扫描应用。入口 `main.lua` 负责启动与生命周期；`config.lua` 读取配置，`chat.lua` 处理聊天请求，`speech.lua` 负责麦克风采集和语音 WebSocket 会话，`view.lua` 创建 LVGL 页面。

在 `config.json` 中设置服务端地址、Character ID 和超时：

```json
{
  "api_url": "http://服务端地址:3000/api/v1/chat/completions",
  "character_id": "testAgent",
  "timeout_ms": 60000
}
```

聊天中文字体 `live2d/font/noto_sans_sc_medium_16_2bpp_common4000.bin` 随应用一起提供，基于 Noto Sans SC，遵循 `live2d/font/OFL-NotoSansCJK.txt` 中的 SIL Open Font License 1.1。

聊天区和状态栏共用该中文字体，路径根据当前应用目录确定。部署时需一并复制 `font/`；启动日志应出现 `[live2d] CJK font loaded`。若出现 `CJK font unavailable`，请检查日志中的 SD 卡字体路径及固件字体加载支持；此时回退的 Montserrat 字体无法显示中文。字库是常用字子集，未收录的生僻字仍可能缺字。

麦克风使用固件的默认 I2S 引脚配置，无需在 `config.json` 中填写。服务端需要注册对应 Character，并为它配置 ASR。App 启动后连接 `/api/speech/stream`，持续发送 16 kHz、16-bit、单声道 PCM；服务端使用本地 Silero VAD 检测说话起止，在静音约 700 ms 后调用 Character 配置的 ASR，并将识别文本发回设备。设备收到文本后自动请求聊天接口。

当前会话消息保存在内存中，聊天区保留完整历史，新消息到达时自动滚动到底部；设备 App 重启后会清空。VAD 模型随服务端部署在 `holocubic-live2d-server/assets/silero_vad_v6.onnx`。真实麦克风格式、网络传输和设备固件运行仍需在 HoloCubic 上验证。
