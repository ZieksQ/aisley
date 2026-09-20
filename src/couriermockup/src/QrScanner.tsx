import { Button } from '@aisley/ui'
import { useEffect, useRef, useState } from 'react'
import type { IScannerControls } from '@zxing/browser'

export function QrScanner({ onRead }: { onRead: (value: string) => void }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const video = useRef<HTMLVideoElement>(null)
  const onReadRef = useRef(onRead)
  onReadRef.current = onRead

  useEffect(() => {
    if (!open || !video.current) return
    let disposed = false
    let controls: IScannerControls | null = null
    void import('@zxing/browser').then(({ BrowserQRCodeReader }) => {
      const reader = new BrowserQRCodeReader()
      return reader.decodeFromVideoDevice(undefined, video.current!, (result) => {
        if (!disposed && result) {
          onReadRef.current(result.getText())
          setOpen(false)
        }
      })
    }).then((next) => {
      controls = next
      if (disposed) controls.stop()
    }).catch((caught: unknown) => {
      if (disposed) return
      setError(caught instanceof DOMException && caught.name === 'NotAllowedError'
        ? 'Camera permission was denied. Enter the QR payload or tracking ID manually.'
        : 'Camera could not start. Enter the QR payload or tracking ID manually.')
      setOpen(false)
    })
    return () => { disposed = true; controls?.stop() }
  }, [open])

  return <>
    <Button className="min-h-10 rounded-md px-4 shadow-none" onClick={() => { setError(null); setOpen((current) => !current) }} variant="outline">{open ? 'Close camera' : 'Scan QR'}</Button>
    {open ? <video aria-label="QR scanner camera preview" className="scanner-video" muted playsInline ref={video} /> : null}
    {error ? <p className="error-message" role="alert">{error}</p> : null}
  </>
}
