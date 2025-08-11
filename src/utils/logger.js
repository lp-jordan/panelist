const isDev = import.meta.env.DEV

export const logger = {
  log: (...args) => {
    if (isDev) console.log(...args)
  },
  info: (...args) => {
    if (isDev) console.info(...args)
  },
  warn: (...args) => {
    if (isDev) console.warn(...args)
  },
  error: (...args) => {
    console.error(...args)
  },
}
