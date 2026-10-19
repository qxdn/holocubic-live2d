# 组件约定

- 我们自己新增的组件使用独立目录，以 `index.tsx` 作为入口，例如 `src/components/story-book/index.tsx`。
- 组件专用的子组件、样式和类型放在该组件目录内；子组件同样使用独立目录和 `index.tsx` 入口。
- 外部通过组件目录路径导入，例如 `@/components/story-book`。
- 初始化自带的组件（如 `theme-provider.tsx`）及 `src/components/ui/` 中由 shadcn 生成的基础组件保留原有文件结构。
- 自定义组件统一使用箭头函数；hook、工具函数及普通回调不强制。
- 自定义组件添加必要的注释，说明用途、非直观行为及使用限制，避免重复代码字面含义。
- 导出的组件、hook、函数、常量及类型必须添加有实际说明内容的 JSDoc 注释；转导出沿用原定义的说明。
- ESLint 在 `src/components/**` 和 `src/App.tsx` 中对大写名称的组件函数约束箭头函数，并约束导出项注释；`src/components/ui/**` 和初始化自带的 `theme-provider.tsx` 不适用这两项规则。
