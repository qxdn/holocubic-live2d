# 待机动画

将鲸鱼娘待机动画命名为 `idle.gif` 放在此目录，随应用复制到设备的 `/sd/apps/live2d/assets/idle.gif`。

请导出为无限循环 GIF，画布不超过 144 × 198 像素，建议先使用 10 FPS 验证设备性能。应用按原始尺寸居中显示，超出角色区域的部分会被裁剪，不会自动缩放。

已附带 `idle.gif`：由 `holocubic/src/asset/whalegirl/frames/idle/` 的 24 帧按 `pet.json` 的顺序合成，等比缩小并居中到 144 × 198 画布，背景为页面颜色 `#111820`。按原速度的 75% 播放，按 GIF 的 10 ms 精度累计取整，总周期为 2660 ms，无限循环。素材作者和许可见源目录的 `pet.json`（wei125775-lab，MIT）。

缺少动作文件时串口打印 action missing；部署时必须一并复制 animations.json。

## 其他动作

全部 12 个动作均已按 `pet.json` 中的帧列表生成，时长按 75% 播放速度延长，尺寸、背景与待机动画一致：

- 循环：`idle.gif`、`eat.gif`、`touchface.gif`、`subagent-loop.gif`。
- 单次：`putaway.gif`、`bless.gif`、`wave.gif`、`heart.gif`、`eat-mid.gif`、`smug.gif`、`subagent-in.gif`、`subagent-out.gif`。

单次 GIF 不包含循环扩展。Lua 启动时播放 idle，Agent 通过正文中的 <motion>动作名</motion> 选择动作；Lua 提取动作、隐藏标签，不调用工具或回传工具结果。单次动作结束返回 idle；循环动作持续到下一条指令。服务端错误只更新状态，不强制切换动作。

在仓库根目录运行 `python holocubic/scripts/build-whale-gifs.py` 可重新生成全部 GIF，需要安装 Pillow。脚本会逐帧解码输出，检查尺寸、帧数、总时长和循环标记。
