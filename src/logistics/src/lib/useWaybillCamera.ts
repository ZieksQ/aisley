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
    let missedReads = 0
    void import('./waybillScanner').then(async ({ startWaybillCamera, cameraErrorMessage }) => {
      if (abort.signal.aborted) return
      try {
        const controls = await startWaybillCamera(video, (raw) => {
          const identity = raw.trim().replace(/^AISLEY:WB:\d+:/i, '').toUpperCase()
          const repeated = identity === lastScan
          // Decode speed varies by device. Reset only after complete barcode/QR misses.
          lastScan = identity
          missedReads = 0
          if (repeated) return
          scan(raw)
        }, abort.signal, (error) => {
          if (!abort.signal.aborted) {
            console.error('Waybill frame decoding failed:', error)
            fail(cameraErrorMessage(error))
          }
        }, () => {
          if (++missedReads >= 2) lastScan = ''
        })
        stop = controls.stop
        if (abort.signal.aborted) stop()
      } catch (error) {
        if (!abort.signal.aborted) {
          console.error('Waybill camera startup failed:', error)
          fail(cameraErrorMessage(error))
        }
      }
    }).catch(() => {
      if (!abort.signal.aborted) fail('The scanner could not load. Reload the page and try again, or enter the tracking ID manually.')
    })
    return () => { abort.abort(); stop?.() }
  }, [open, videoRef])
}
