import pino from 'pino'

/** 业务日志保留完整记录，error 及以上同时写入独立文件。 */
export const logger = pino({
  level: 'info',
  transport: {
    targets: [
      { target: 'pino/file', options: { destination: 1 } },
      {
        target: 'pino/file',
        level: 'info',
        options: { destination: './logs/app.log', mkdir: true },
      },
      {
        target: 'pino/file',
        level: 'error',
        options: { destination: './logs/error.log', mkdir: true },
      },
    ],
  },
})
