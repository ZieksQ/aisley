"use client";

import { useEffect, useSyncExternalStore } from 'react'

function subscribeOnline(listener: () => void) {
  window.addEventListener('online', listener)
  window.addEventListener('offline', listener)
  return () => {
    window.removeEventListener('online', listener)
    window.removeEventListener('offline', listener)
  }
}

export function useCourierOnline() {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true)
}

// One foreground refresh at a time, with cancellation when its view is replaced.
export function useCourierRefresh(refresh: (signal: AbortSignal) => Promise<void>, revision = 0) {
  useEffect(() => {
    const controller = new AbortController()
    let busy = false
    const run = async () => {
      if (busy || controller.signal.aborted || document.hidden || !navigator.onLine) return
      busy = true
      try { await refresh(controller.signal) } finally { busy = false }
    }
    const trigger = () => { void run() }
    trigger()
    const timer = window.setInterval(trigger, 15000)
    window.addEventListener('focus', trigger)
    window.addEventListener('online', trigger)
    document.addEventListener('visibilitychange', trigger)
    return () => {
      controller.abort()
      window.clearInterval(timer)
      window.removeEventListener('focus', trigger)
      window.removeEventListener('online', trigger)
      document.removeEventListener('visibilitychange', trigger)
    }
  }, [refresh, revision])
}
