import { clsx } from 'clsx'

export function cn(...inputs) {
  return clsx(inputs)
}

export function throttle(fn, wait) {
  let timeout = null
  let lastCall = 0
  return (...args) => {
    const now = Date.now()
    const remaining = wait - (now - lastCall)
    if (remaining <= 0) {
      if (timeout) {
        clearTimeout(timeout)
        timeout = null
      }
      lastCall = now
      fn(...args)
    } else if (!timeout) {
      timeout = setTimeout(() => {
        lastCall = Date.now()
        timeout = null
        fn(...args)
      }, remaining)
    }
  }
}
