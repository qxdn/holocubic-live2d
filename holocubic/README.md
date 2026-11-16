# HoloCubic Chat

将 `live2d/` 内所有文件复制到设备 SD 卡的 `/sd/apps/live2d/`，在 Launcher 中重新扫描应用。入口 `main.lua` 负责启动与生命周期；`config.lua` 读取配置，`chat.lua` 处理聊天 SSE，`audio.lua` 持有录音和播放共用的 I2S 0 实例状态及配置，统一启动、停止和隔离过期回调；`tts.lua` 负责 PCM 缓冲和播放，`speech.lua` 负责麦克风采集和语音 WebSocket 会话，`view.lua` 创建 LVGL 页面。

在 `config.json` 中设置服务端地址、Character ID 和超时：

```json
{
  "api_url": "http://服务端地址:3000/api/v1/chat/completions",
  "character_id": "deepseek-whale",
  "timeout_ms": 60000
}
```

页面左侧为 144 × 198 像素角色区，右侧聊天隐藏名字，用户蓝色气泡靠右、角色灰色气泡靠左，保留完整历史并自动滚动。启动播放 idle；服务端仅对 frame2d 角色追加动作提示词，Agent 在回复正文写 <motion>wave</motion> 等标签。Lua 从正文提取第一个有效动作名，隐藏标签并显示正文，无需动作工具或 tool 回执。Live2D 保留原有客户端工具协议。单次动作结束回到 idle，循环动作持续到下一条指令，同一循环动作不会重复加载。错误响应仅更新状态，保留用户消息、现有气泡和动画。全部 GIF 为原速度的 75%（约 9 FPS）。部署时一并复制 assets/，包括 animations.json。串口打印 motion tag（动作名）、action requested、action play、action complete 和 action clean。

聊天中文字体 `live2d/font/noto_sans_sc_medium_16_2bpp_common4000.bin` 随应用一起提供，基于 Noto Sans SC，遵循 `live2d/font/OFL-NotoSansCJK.txt` 中的 SIL Open Font License 1.1。

角色回复在屏幕上转换为纯文本，去除常见标题、粗体、行内代码、链接和代码围栏标记，列表保留分行，简单表格转换为分隔文本；原始消息仍用于对话请求。新增气泡后延后 80 ms 将内容末尾标记滚入视野，串口打印 `chat scrolled to end`。这是轻量文本处理，不是完整 Markdown 渲染器。

聊天区和状态栏共用该中文字体，路径根据当前应用目录确定。部署时需一并复制 `font/`；启动日志应出现 `[live2d] CJK font loaded`。若出现 `CJK font unavailable`，请检查日志中的 SD 卡字体路径及固件字体加载支持；此时回退的 Montserrat 字体无法显示中文。字库是常用字子集，未收录的生僻字仍可能缺字。

麦克风使用固件的默认 I2S 引脚配置，无需在 `config.json` 中填写。服务端需要注册对应 Character，并为它配置 ASR。App 启动后连接 `/api/speech/stream`，持续发送 16 kHz、16-bit、单声道 PCM；服务端使用本地 Silero VAD 检测说话起止，在静音约 700 ms 后调用 Character 配置的 ASR，并将识别文本发回设备。设备收到文本后自动请求聊天接口。

当前会话消息保存在内存中，聊天区保留完整历史，新消息到达时自动滚动到底部；设备 App 重启后会清空。VAD 模型随服务端部署在 `holocubic-live2d-server/assets/silero_vad_v6.onnx`。真实麦克风格式、网络传输和设备固件运行仍需在 HoloCubic 上验证。

聊天默认开启 TTS：从现有 `api_url` 推导 `/api/chat`，发送 Character ID、UI message 历史和 `enableTts: true`，无需修改现有配置。服务端必须为该 Character 配置 `speech.tts`；音色和密钥均由服务端管理。文字增量更新气泡，完整动作标签触发动画；音频事件解码为 24 kHz、单声道 PCM16，使用设备自带 MP3 播放器相同的 I2S 输出配置（data_out_pin = 48）播放。请求期间暂停麦克风，累计约 1 秒音频后起播，使用 I2S tx 完成回调续送，每次最多 4096 字节。参考音乐播放器的低水位策略，队列不足 250 ms 时暂停送数，保留 I2S，累计约 1 秒后由音频入队唤醒续播；合成结束时直接送完短尾音。仅在最终播放结束时用静音排空 DMA，然后关闭 I2S，等待 HTTP 也完成后恢复采集。音频持续接收并在 Lua 内存中排队，不按队列时长暂停 HTTP 接收，也不设置队列截断。此实现仍使用 Lua 回调，未复用音乐播放器 `audio.so` 的原生双任务及 PSRAM 环形缓冲；保留 I2S 等待期间的实际扬声器行为需设备验证。请求失败或退出 App 时关闭请求、停止播放并清理队列。

可在仓库根目录执行 `lua holocubic/tests/tts.lua`，用模拟固件接口验证 SSE 拆包、动作、PCM 顺序、播放完成、长回复持续接收、缺数据恢复和异常清理。此测试不替代设备扬声器及 I2S 收发切换验证。

PCM 使用可扩容的分块环形队列，复用槽位并在消费后释放音频引用；容量按需增长，不会截断长回复，也不等同于原生模块的固定 PSRAM 字节缓冲。Base64 按批次转换，减少三字节临时字符串。`lua holocubic/tests/audio.lua` 验证共享 I2S 的模式切换、过期回调、启动失败恢复，以及 ASR 断线和清理不误停 TTS。
