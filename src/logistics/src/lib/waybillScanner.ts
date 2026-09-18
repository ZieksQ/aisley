import { BrowserCodeReader, BrowserMultiFormatOneDReader, type IScannerControls } from '@zxing/browser'
import { BarcodeFormat, BinaryBitmap, ChecksumException, DecodeHintType, FormatException, HybridBinarizer, NotFoundException, RGBLuminanceSource } from '@zxing/library'

export function createWaybillReader(): BrowserMultiFormatOneDReader {
  // Thin waybill bars can fall between the default reader's sampled rows.
  // Search every row and exclude QR so it cannot win over the tracking barcode.
  return new BrowserMultiFormatOneDReader(new Map<DecodeHintType, unknown>([
    [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128]],
    [DecodeHintType.TRY_HARDER, true],
  ]))
}

// @zxing/browser 0.2.1 leaves its rotation canvas uninitialized. TRY_HARDER
// therefore throws on ordinary frames with no barcode. Rotate luminance data
// directly instead of using that canvas-backed source.
class WaybillLuminanceSource extends RGBLuminanceSource {
  override isRotateSupported(): boolean { return true }

  override rotateCounterClockwise(): WaybillLuminanceSource {
    const width = this.getWidth()
    const height = this.getHeight()
    const pixels = this.getMatrix()
    const rotated = new Uint8ClampedArray(pixels.length)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) rotated[(width - x - 1) * height + y] = pixels[y * width + x]
    }
    return new WaybillLuminanceSource(rotated, height, width)
  }
}

export function decodeWaybillCanvas(reader: BrowserMultiFormatOneDReader, canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Camera frame canvas unavailable')
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
  const luminance = new Uint8ClampedArray(canvas.width * canvas.height)
  for (let i = 0, pixel = 0; i < data.length; i += 4, pixel++) {
    luminance[pixel] = data[i + 3] === 0 ? 255 : (306 * data[i] + 601 * data[i + 1] + 117 * data[i + 2] + 512) >> 10
  }
  return reader.decodeBitmap(new BinaryBitmap(new HybridBinarizer(new WaybillLuminanceSource(luminance, canvas.width, canvas.height))))
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
    default: return 'Camera scanning failed. Try again or enter the tracking ID manually.'
  }
}

// A missing/temporarily unavailable video frame is normal during camera warmup.
// ZXing's built-in scan loop finalizes the stream on InvalidStateError.
export function scanWaybillVideo(
  video: HTMLVideoElement,
  onScan: (raw: string) => void,
  onError: (error: unknown) => void,
): IScannerControls {
  const reader = createWaybillReader()
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let canvas: HTMLCanvasElement | undefined
  const stop = () => { stopped = true; clearTimeout(timer); canvas = undefined }
  const loop = () => {
    if (stopped) return
    try {
      if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        if (!canvas || canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas = BrowserCodeReader.createCaptureCanvas(video)
        }
        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (!context) throw new Error('Camera frame canvas unavailable')
        BrowserCodeReader.drawImageOnCanvas(context, video)
        const result = decodeWaybillCanvas(reader, canvas)
        onScan(result.getText())
      }
    } catch (error) {
      if (!(error instanceof NotFoundException || error instanceof ChecksumException || error instanceof FormatException)
        && errorName(error) !== 'InvalidStateError') {
        stop()
        onError(error)
        return
      }
    }
    if (!stopped) timer = setTimeout(loop, 150)
  }
  // Defer the first scan until controls have been returned to the owner.
  timer = setTimeout(loop, 0)
  return { stop }
}

// Own the stream before playback begins so Stop/unmount also cancels startup.
export async function startWaybillCamera(
  video: HTMLVideoElement,
  onScan: (raw: string) => void,
  signal: AbortSignal,
  onError: (error: unknown) => void = () => {},
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
      let playbackStarted = false
      const finish = (error?: unknown) => {
        clearTimeout(timer)
        signal.removeEventListener('abort', aborted)
        video.removeEventListener('loadeddata', ready)
        video.removeEventListener('canplay', ready)
        video.removeEventListener('canplay', play)
        if (error) reject(error)
        else resolve()
      }
      const aborted = () => finish(signal.reason)
      const ready = () => {
        if (playbackStarted && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) finish()
      }
      const timer = setTimeout(() => finish(new DOMException('Preview timed out', 'CameraPlaybackError')), 15000)
      signal.addEventListener('abort', aborted, { once: true })
      video.addEventListener('loadeddata', ready)
      video.addEventListener('canplay', ready)
      function play() {
        void video.play().then(() => { playbackStarted = true; ready() }, (error: unknown) => {
          if (errorName(error) === 'AbortError' && !signal.aborted) return
          finish(new DOMException('Preview failed', 'CameraPlaybackError'))
        })
      }
      video.addEventListener('canplay', play, { once: true })
      play()
    })
    signal.throwIfAborted()
    controls = scanWaybillVideo(video, (raw) => {
      if (!signal.aborted) onScan(raw)
    }, (error) => {
      stop()
      if (!signal.aborted) onError(error)
    })
    return { stop }
  } catch (error) {
    stop()
    throw error
  }
}
