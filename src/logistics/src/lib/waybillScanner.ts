import { BrowserMultiFormatOneDReader } from '@zxing/browser'
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
