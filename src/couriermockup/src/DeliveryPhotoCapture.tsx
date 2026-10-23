import { Button } from '@aisley/ui'
import { useEffect, useRef, useState } from 'react'

export function DeliveryPhotoCapture({ photo, onPhoto, busy, retrying }: {
  photo: File | null
  onPhoto: (photo: File | null) => void
  busy: boolean
  retrying: boolean
}) {
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const photoInput = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const cameraStream = useRef<MediaStream | null>(null)
  const cameraRequest = useRef(0)
  function stopCamera() {
    cameraRequest.current++
    cameraStream.current?.getTracks().forEach((track) => track.stop())
    cameraStream.current = null
    setCameraReady(false)
    if (videoRef.current) videoRef.current.srcObject = null
  }

  async function openCamera() {
    stopCamera()
    const requestId = ++cameraRequest.current
    setCameraOpen(true)
    setCameraError(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Live camera is unavailable in this browser. Choose a photo from this device instead.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      if (requestId !== cameraRequest.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      cameraStream.current = stream
      setCameraReady(true)
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch {
      if (requestId === cameraRequest.current) setCameraError('Camera access was denied or unavailable. Check permission, or choose a photo from this device.')
    }
  }

  function closeCamera() {
    stopCamera()
    setCameraOpen(false)
  }

  function capturePhoto() {
    const video = videoRef.current
    if (!video || !video.videoWidth || !video.videoHeight) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    const requestId = cameraRequest.current
    canvas.toBlob((blob) => {
      if (blob && requestId === cameraRequest.current) {
        onPhoto(new File([blob], `delivery-${Date.now()}.jpg`, { type: 'image/jpeg' }))
        closeCamera()
      }
    }, 'image/jpeg', 0.9)
  }

  useEffect(() => () => { cameraRequest.current++; cameraStream.current?.getTracks().forEach((track) => track.stop()) }, [])
  useEffect(() => {
    if (cameraOpen && videoRef.current && cameraStream.current) videoRef.current.srcObject = cameraStream.current
  }, [cameraOpen, cameraError, cameraReady])
  useEffect(() => {
    if (!photo) { setPhotoPreview(null); return }
    const url = URL.createObjectURL(photo)
    setPhotoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  return <div className="space-y-2">
    <input accept="image/jpeg,image/png,image/webp" capture="environment" hidden id="delivery-photo" onChange={(event) => { onPhoto(event.target.files?.[0] ?? null); event.target.value = ''; closeCamera() }} ref={photoInput} type="file" />
    <div className="flex flex-wrap gap-2">
      <Button className="min-h-11 rounded-md px-4 shadow-none" disabled={busy} onClick={() => void openCamera()} variant="outline">{retrying ? 'Retry delivery · open POD camera' : 'Take parcel photo'}</Button>
      <Button className="min-h-11 rounded-md px-4 shadow-none" disabled={busy} onClick={() => photoInput.current?.click()} variant="outline">Choose photo</Button>
    </div>
    <p className="status-line">JPEG, PNG, or WebP; under 10 MB. Frame the delivered parcel clearly.</p>
    {cameraOpen ? <div aria-label="Delivery camera" className="space-y-2 border border-zinc-300 p-3 dark:border-white/15" role="group">
      <video autoPlay className="max-h-80 w-full bg-black object-contain" playsInline ref={videoRef} />
      <p className="status-line" role="status">{cameraError ?? 'Frame the delivered parcel and capture a photo.'}</p>
      <div className="flex flex-wrap gap-2">
        <Button className="min-h-10 rounded-md px-4 shadow-none" disabled={busy || !cameraReady} onClick={capturePhoto} variant="secondary">Capture photo</Button>
        <Button className="min-h-10 rounded-md px-4 shadow-none" onClick={closeCamera} variant="outline">Close camera</Button>
      </div>
    </div> : null}
    {photo && photoPreview ? <div className="space-y-2">
      <img alt="Selected delivery proof preview" className="max-h-64 max-w-full border border-zinc-300 object-contain dark:border-white/15" src={photoPreview} />
      <p>{photo.name}</p>
      <Button className="min-h-10 rounded-md px-4 shadow-none" disabled={busy} onClick={() => { onPhoto(null); void openCamera() }} variant="outline">Retake photo</Button>
    </div> : null}
    {photo && photo.size >= 10 * 1024 * 1024 ? <p className="error-message" role="alert">Choose a photo under 10 MB.</p> : null}
  </div>
}
