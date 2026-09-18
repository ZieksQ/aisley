import { useEffect, useEffectEvent, type RefObject } from 'react'

// Scan handlers use current page state without restarting the camera on updates.
export function useWaybillCamera(
  open: boolean,
  videoRef: RefObject<HTMLVideoElement | null>,
  onScan: (raw: string) => void,
  onError: (message: string) => void,
) {
  const scan = useEffectEvent(onScan)
  const fail = useEffectEvent(onError)
  useEffect(() => {
    const video = videoRef.current
    if (!open || !video) return
    const abort = new AbortController()
    let stop: (() => void) | undefined
    let lastScan = ''
    let lastScanAt = 0
    void import('./waybillScanner').then(async ({ startWaybillCamera, cameraErrorMessage }) => {
      if (abort.signal.aborted) return
      try {
        const controls = await startWaybillCamera(video, (raw) => {
          const now = Date.now()
          if (raw === lastScan && now - lastScanAt < 1200) return
          lastScan = raw
          lastScanAt = now
          scan(raw)
        }, abort.signal)
        stop = controls.stop
        if (abort.signal.aborted) stop()
      } catch (error) {
        if (!abort.signal.aborted) fail(cameraErrorMessage(error))
      }
    }).catch(() => {
      if (!abort.signal.aborted) fail('The scanner could not load. Reload the page and try again, or enter the tracking ID manually.')
    })
    return () => { abort.abort(); stop?.() }
  }, [open, videoRef])
}
