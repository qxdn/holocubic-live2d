import { WebSocketServer } from 'ws'
import type { WebSocketConfig } from '../config/index.ts'

/** Creates the noServer instance consumed by @hono/node-server's adapter. */
export function initWebSocketServer(config: WebSocketConfig): WebSocketServer {
  return new WebSocketServer({
    noServer: config.noServer,
    maxPayload: config.maxPayload,
    perMessageDeflate: config.perMessageDeflate,
  })
}
