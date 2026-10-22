import { PortalButton, PortalScanner } from '@aisley/ui/portal'
import { useRef, useState } from 'react'
import { ErrorNotice } from '../../components/PickupUi'
import { useWaybillCamera } from '../../lib/useWaybillCamera'
import type { useReceiving } from './useReceiving'

export function ReceiptCapture({ capture, feedback, error }: { feedback?: string; error?: string; capture: ReturnType<typeof useReceiving>['capture'] }) {
  const [reference, setReference] = useState('')
  const [condition, setCondition] = useState<'good' | 'damaged'>('good')
  const [reason, setReason] = useState('')
  const [camera, setCamera] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const video = useRef<HTMLVideoElement>(null)

  useWaybillCamera(camera, video,
    (raw) => { void capture(raw, 'barcode', condition, reason) },
    (message) => { setCameraError(message); setCamera(false) },
  )

  return <div className="mt-4"><PortalScanner title="Barcode & QR scanner" feedback={feedback} error={cameraError || error} controls={<PortalButton onClick={() => setCamera(!camera)}>{camera ? 'Stop camera' : 'Start camera'}</PortalButton>}>
    {cameraError ? <ErrorNotice message={cameraError} /> : null}
    <div className="grid gap-4 p-4 md:grid-cols-2">
      <div>
        <label className="block text-sm">
          Parcel condition
          <select className={`portal-input mt-1`} value={condition}
            onChange={(event) => setCondition(event.target.value as 'good' | 'damaged')}>
            <option value="good">Good</option>
            <option value="damaged">Damaged — hold for inspection</option>
          </select>
        </label>
        {condition === 'damaged' ? <label className="mt-3 block text-sm">
          Damage observed
          <textarea className={`portal-input mt-1`} maxLength={1000} value={reason}
            onChange={(event) => setReason(event.target.value)} />
        </label> : null}
        {camera ? <video className="mt-2 aspect-video w-full bg-black object-contain"
          ref={video} autoPlay muted playsInline /> : null}
      </div>
      <form onSubmit={(event) => {
        event.preventDefault()
        void capture(reference, 'manual', condition, reason)
        setReference('')
      }}>
        <label className="block text-sm">
          Tracking ID
          <input className={`portal-input mt-1`} value={reference} maxLength={255}
            onChange={(event) => setReference(event.target.value)} autoComplete="off" />
        </label>
        <PortalButton variant="primary" type="submit" className="mt-3">Capture parcel</PortalButton>
        <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
          A locally captured scan transfers custody only after server verification.
          Unexpected IDs are recorded for investigation.
        </p>
      </form>
    </div>
  </PortalScanner></div>
}
