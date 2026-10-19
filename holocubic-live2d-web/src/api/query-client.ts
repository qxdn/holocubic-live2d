import {
  isCancelledError,
  MutationCache,
  QueryCache,
  QueryClient,
} from "@tanstack/react-query"
import { toast } from "sonner"

function showError(error: Error) {
  // 组件卸载或主动取消请求不需要提示。
  if (error.name === "AbortError" || isCancelledError(error)) return

  const message = error.message || "请求失败，请稍后重试"
  // 相同消息复用同一个 Toast，避免多个请求同时失败时堆叠。
  toast.error(message, { id: message })
}

// 在组件外创建，避免重新渲染时丢失缓存。
export const queryClient = new QueryClient({
  // 在重试结束、最终失败时统一提示，页面无需重复 Toast。
  queryCache: new QueryCache({ onError: showError }),
  mutationCache: new MutationCache({ onError: showError }),
})
