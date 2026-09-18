import { BrowserMultiFormatOneDReader, type IScannerControls } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'

export function createWaybillReader(): BrowserMultiFormatOneDReader {
  // Thin waybill bars can fall between the default reader's sampled rows.
  // Search every row and exclude QR so it cannot win over the tracking barcode.
  return new BrowserMultiFormatOneDReader(new Map<DecodeHintType, unknown>([
    [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128]],
    [DecodeHintType.TRY_HARDER, true],
  ]))
}

export const waybillCameraConstraints: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  },
}

function errorName(error: unknown): string {
  return error && typeof error === 'object' && 'name' in error ? String(error.name) : ''
}

export function cameraErrorMessage(error: unknown): string {
  switch (errorName(error)) {
    case 'InsecureContextError': return 'Camera scanning requires HTTPS (or localhost). Open Logistics through HTTPS, then try again.'
    case 'UnsupportedCameraError': return 'This browser does not support camera access. Try a current browser or enter the tracking ID manually.'
    case 'NotAllowedError':
    case 'SecurityError': return 'Camera access is blocked. Check site and device camera permissions, then try again.'
    case 'NotFoundError': return 'No camera was found. Connect a camera or enter the tracking ID manually.'
    case 'NotReadableError': return 'The camera is unavailable. Close other apps or tabs using it, check device camera access, then try again.'
    case 'OverconstrainedError': return 'The camera does not support these settings. Try another camera or enter the tracking ID manually.'
    case 'CameraPlaybackError': return 'The camera preview could not play. Stop and restart the camera, or enter the tracking ID manually.'
    default: return 'The camera could not start. Try again or enter the tracking ID manually.'
  }
}

// Own the stream before playback begins so Stop/unmount also cancels startup.
export async function startWaybillCamera(
  video: HTMLVideoElement,
  onScan: (raw: string) => void,
  signal: AbortSignal,
): Promise<IScannerControls> {
  signal.throwIfAborted()
  if (!window.isSecureContext) throw new DOMException('HTTPS required', 'InsecureContextError')
  if (!navigator.mediaDevices?.getUserMedia) throw new DOMException('Camera API unavailable', 'UnsupportedCameraError')
  let stream: MediaStream | undefined
  let controls: IScannerControls | undefined
  const release = () => {
    stream?.getTracks().forEach((track) => track.stop())
    if (stream && video.srcObject === stream) {
      video.pause()
      video.srcObject = null
    }
  }
  const stop = () => {
    signal.removeEventListener('abort', stop)
    controls?.stop()
    release()
  }
  signal.addEventListener('abort', stop, { once: true })
  try {
    try {
      stream = await navigator.mediaDevices.getUserMedia(waybillCameraConstraints)
    } catch (error) {
      signal.throwIfAborted()
      if (errorName(error) !== 'OverconstrainedError') throw error
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true })
    }
    signal.throwIfAborted()
    video.muted = true
    video.autoplay = true
    video.playsInline = true
    video.srcObject = stream
    await new Promise<void>((resolve, reject) => {
      const finish = (error?: unknown) => {
        clearTimeout(timer)
        signal.removeEventListener('abort', aborted)
        if (error) reject(error)
        else resolve()
      }
      const aborted = () => finish(signal.reason)
      const timer = setTimeout(() => finish(new DOMException('Preview timed out', 'CameraPlaybackError')), 15000)
      signal.addEventListener('abort', aborted, { once: true })
      void video.play().then(() => finish(), () => finish(new DOMException('Preview failed', 'CameraPlaybackError')))
    })
    signal.throwIfAborted()
    controls = createWaybillReader().scan(video, (result) => {
      if (!signal.aborted && result) onScan(result.getText())
    }, release)
    return { stop }
  } catch (error) {
    stop()
    throw error
  }
}
