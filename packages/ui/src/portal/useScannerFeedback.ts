import { useEffect, useRef, useState } from 'react'

export type ScannerFeedback = { id: string; message: string }
type Notification = { message: string; tone: 'success' | 'error' }

export function useScannerFeedback(expanded: boolean, capture?: ScannerFeedback, error?: string) {
  const [notification, setNotification] = useState<Notification | null>(null)
  const audio = useRef<AudioContext | null>(null)
  const seen = useRef(capture?.id)

  function prepare() {
    seen.current = capture?.id
    setNotification(null)
    try {
      const Audio = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (Audio) audio.current ??= new Audio()
      void audio.current?.resume().catch(() => {})
    } catch { /* Scanning stays available when a browser disallows sound. */ }
  }

  useEffect(() => {
    if (!expanded || !capture || seen.current === capture.id) return
    seen.current = capture.id
    setNotification({ message: capture.message, tone: 'success' })
    const context = audio.current
    if (!context || context.state !== 'running') return
    try {
      const start = context.currentTime
      for (const [offset, frequency] of [[0, 880], [.1, 1174]]) {
        const oscillator = context.createOscillator()
        const gain = context.createGain()
        oscillator.type = 'sine'
        oscillator.frequency.value = frequency
        gain.gain.setValueAtTime(0, start + offset)
        gain.gain.linearRampToValueAtTime(.12, start + offset + .01)
        gain.gain.exponentialRampToValueAtTime(.001, start + offset + .12)
        oscillator.connect(gain)
        gain.connect(context.destination)
        oscillator.start(start + offset)
        oscillator.stop(start + offset + .14)
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
      }
    } catch { /* Audio failure must never interrupt capture or synchronization. */ }
  }, [expanded, capture])

  useEffect(() => {
    if (expanded && error) setNotification({ message: error, tone: 'error' })
  }, [expanded, error])

  useEffect(() => {
    if (!notification) return
    const timer = window.setTimeout(() => setNotification(null), 5000)
    return () => window.clearTimeout(timer)
  }, [notification])

  useEffect(() => () => { void audio.current?.close().catch(() => {}) }, [])

  return { notification, prepare }
}
