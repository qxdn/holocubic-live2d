# React + TypeScript + Vite + shadcn/ui

This is a template for a new Vite project with React, TypeScript, and shadcn/ui.

## Live2D

前端使用 PixiJS 6 与 `pixi-live2d-display/cubism4`，在桌面布局右侧加载本地 Haru 示例模型。
目前只包含模型展示和库默认的待机动画，尚未接入聊天、语音或点击动作。
画布跟随容器缩放；窄屏沿用现有布局隐藏右侧区域并暂停动画。

替换模型时，将完整模型目录放入 `public/models/`，保留模型文件引用的相对路径，
然后修改 `src/App.tsx` 中 `Live2D` 的 `modelUrl`，指向对应的 `.model3.json`。
`public/live2d/live2dcubismcore.min.js` 在应用启动前加载，不能作为普通 ES 模块导入。

资源来源与许可：

- Haru 模型及配套资源：[官方 CubismWebSamples，4-r.7](https://github.com/Live2D/CubismWebSamples/tree/4-r.7/Samples/Resources/Haru)，适用 [Live2D Free Material License](https://www.live2d.com/eula/live2d-free-material-license-agreement_en.html)。
- Cubism Core：[Live2D 官方分发文件](https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js)，保留文件内版权和许可声明，适用 [Live2D Proprietary Software License](https://www.live2d.com/eula/live2d-proprietary-software-license-agreement_en.html)。

## API 请求

后端更新接口后，先在 `holocubic-live2d-server` 运行 `pnpm openapi:generate`，
再在本目录运行 `pnpm api:generate`。Orval 读取后端本地的 `openapi.json`，
生成 React Query hooks、请求函数和类型到 `src/api/generated.ts` 和 `src/api/models/`，
请勿手动修改这些文件。应用入口已注册 `QueryClientProvider`。

普通业务 GET 接口生成查询 hooks，POST 接口生成提交 hooks。
hooks 支持通过 `query` / `mutation` 选项覆盖行为，通过 `request` 选项传入 Fetch 的
`RequestInit` 配置。标记为 `AI` 的接口暂不生成请求，后续单独接入 AI SDK。

`src/api/query-client.ts` 管理全局缓存和错误提示：缓存新鲜时间使用默认值，
查询重试使用 React Query 默认行为；提交不自动重试。查询和提交最终失败时统一弹出 Sonner Toast，
主动取消不提示，页面无需重复 Toast。直接调用生成的请求函数不经过此提示流程。

`src/api/request.ts` 使用浏览器原生 Fetch，供 Orval 生成的普通业务接口调用：

- 补充缺省的 `Accept: application/json`，保留调用方设置的值。
- 检查 HTTP 状态及业务 `success`，失败时使用后端 `message` 抛出 `ApiError`。
- `ApiError.status` / `ApiError.body` 保留状态码和原始响应。
- 成功时直接返回业务 `data`，生成函数和 hooks 自动推导解包后的类型。
- 保留取消信号；错误交给 React Query 管理，最终失败时才弹 Toast。

默认使用当前站点地址；Vite 开发代理将 `/api` 转发到 `http://localhost:3000`。
生产环境需配置同源 `/api` 反向代理，或通过 `.env.local` 的 `VITE_API_BASE_URL`
设置后端 origin（不要包含 `/api`，跨域时需后端允许 CORS）。参见 `.env.example`。

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `src/components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button"
```
