import { useEffect, useRef, useState } from 'react'
import { FaArrowLeft, FaArrowsRotate } from 'react-icons/fa6'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ActionButton, ErrorNotice, link, panel } from '../components/PickupUi'
import { ApiError, blob, requestWithTimeout } from '../lib/api'
import type { CourierVehicle, CourierVehicleResponse, VehicleDocument } from '../types/vehicles'

type DocumentState = 'idle' | 'loading' | 'ready' | 'forbidden' | 'unavailable'
type DocumentKind = 'official_receipt' | 'certificate_of_registration'

function vehicleError(caught: unknown): string {
  if (!navigator.onLine) return 'You appear to be offline. Reconnect and try again.'
  if (caught instanceof ApiError) {
    if (caught.status === 404) return 'This Courier vehicle is unavailable to your organization or no longer exists.'
    if (caught.status === 403) return 'You do not have access to this Courier vehicle.'
    if (caught.status === 408) return 'The request timed out. Check your connection and try again.'
    return caught.message
  }
  return 'We could not load this Courier vehicle. Try again.'
}

function VehicleDocumentCard({ courierId, document, kind, label }: { courierId: string; document: VehicleDocument | null; kind: DocumentKind; label: string }) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [state, setState] = useState<DocumentState>('idle')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [extension, setExtension] = useState('jpg')
  const objectUrl = useRef<string | null>(null)
  const active = useRef(true)
  const requestId = useRef(0)

  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
      requestId.current += 1
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
      objectUrl.current = null
    }
  }, [])

  async function preview() {
    if (!document || state === 'loading') return
    const expected = `/api/v1/logistics/couriers/${encodeURIComponent(courierId)}/vehicle/documents/${kind}`
    if (document.url !== expected) {
      setState('unavailable')
      return
    }
    const currentRequest = ++requestId.current
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
    objectUrl.current = null
    setPreviewUrl(null)
    setState('loading')
    try {
      const image = await blob(document.url)
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.type)) throw new Error('Unsupported document image')
      if (!active.current || currentRequest !== requestId.current) return
      const url = URL.createObjectURL(image)
      objectUrl.current = url
      setPreviewUrl(url)
      setExtension(image.type === 'image/png' ? 'png' : image.type === 'image/webp' ? 'webp' : 'jpg')
      setState('ready')
    } catch (caught) {
      if (!active.current || currentRequest !== requestId.current) return
      if (caught instanceof ApiError && caught.status === 401) {
        await logout().catch(() => undefined)
        navigate('/login', { replace: true })
        return
      }
      if (caught instanceof ApiError && caught.status === 403 && caught.code === 'POLICY_CONSENT_REQUIRED') {
        navigate('/policy-consent', { replace: true })
        return
      }
      setState(caught instanceof ApiError && caught.status === 403 ? 'forbidden' : 'unavailable')
    }
  }

  function previewFailed() {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
    objectUrl.current = null
    setPreviewUrl(null)
    setState('unavailable')
  }

  return <div className="border-t border-zinc-200 py-4 first:border-t-0 first:pt-0 last:pb-0 dark:border-white/10">
    <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-medium">{label}</h4><span className="text-xs text-zinc-600 dark:text-zinc-400">{document ? 'Uploaded' : 'Not uploaded'}</span></div>
    {!document ? <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Not uploaded</p> : state === 'ready' && previewUrl ? <div className="mt-3 space-y-3"><div className="border border-zinc-200 bg-zinc-50 p-2 dark:border-white/10 dark:bg-[#111113]"><img alt={`${label} for the current Courier vehicle`} className="mx-auto max-h-80 max-w-full object-contain" onError={previewFailed} src={previewUrl} /></div><div className="flex flex-wrap gap-4 text-sm"><a className={link} download={`${kind}-${document.id}.${extension}`} href={previewUrl}>Download image</a><button className={link} onClick={() => void preview()} type="button">Reload preview</button></div></div> : state === 'loading' ? <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400" role="status">Loading private document…</p> : state === 'forbidden' ? <p className="mt-2 text-sm text-red-700 dark:text-red-300" role="alert">This document is not available to your Logistics account.</p> : state === 'unavailable' ? <div className="mt-2 flex flex-wrap items-center gap-3"><p className="text-sm text-amber-800 dark:text-amber-300" role="alert">The document is unavailable right now.</p><button className={link} onClick={() => void preview()} type="button">Try again</button></div> : <button className="mt-3 h-10 rounded-md border border-zinc-300 px-3 text-sm font-medium hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4C1268] dark:border-white/15 dark:hover:bg-white/10" onClick={() => void preview()} type="button">Preview private document</button>}
  </div>
}

export function CourierVehiclePage() {
  const { courierId = '' } = useParams()
  const { logistics, logout } = useAuth()
  const navigate = useNavigate()
  const scope = `${logistics?.id ?? ''}:${courierId}`
  const [record, setRecord] = useState<{ scope: string; vehicle: CourierVehicle } | null>(null)
  const vehicle = record?.scope === scope ? record.vehicle : null
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    document.title = 'Courier vehicle | Aisley Logistics'
    let active = true
    setRecord(null)
    setLoading(true)
    setError('')
    requestWithTimeout<CourierVehicleResponse>(`/api/v1/logistics/couriers/${encodeURIComponent(courierId)}/vehicle`)
      .then((response) => { if (active) setRecord({ scope, vehicle: response.data }) })
      .catch(async (caught: unknown) => {
        if (!active) return
        if (caught instanceof ApiError && caught.status === 401) {
          await logout().catch(() => undefined)
          if (active) navigate('/login', { replace: true })
          return
        }
        if (caught instanceof ApiError && caught.status === 403 && caught.code === 'POLICY_CONSENT_REQUIRED') {
          navigate('/policy-consent', { replace: true })
          return
        }
        setError(vehicleError(caught))
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [courierId, scope, refresh, logout, navigate])

  return <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 lg:px-8">
    <Link className={`${link} inline-flex items-center gap-2 text-sm`} to="/notifications"><FaArrowLeft aria-hidden="true" />Back to notifications</Link>
    <div className="mt-4 flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 pb-4 dark:border-white/10"><div><h2 className="text-xl font-semibold">Courier vehicle</h2><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Current details for an affiliated Courier.</p></div><ActionButton busy={loading} onClick={() => setRefresh((value) => value + 1)}><FaArrowsRotate aria-hidden="true" />Refresh</ActionButton></div>
    {loading ? <p className="mt-5 text-sm text-zinc-600 dark:text-zinc-400" role="status">Loading Courier vehicle…</p> : null}
    {error ? <div className="mt-5"><ErrorNotice message={error} retry={() => setRefresh((value) => value + 1)} /></div> : null}
    {vehicle ? <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
      <section className={`${panel} p-4 sm:p-5`} aria-labelledby="vehicle-details-title"><h3 className="font-semibold" id="vehicle-details-title">Vehicle details</h3><dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2"><div><dt className="text-xs text-zinc-600 dark:text-zinc-400">Type</dt><dd className="mt-1 text-sm capitalize">{vehicle.vehicle_type.replaceAll('_', ' ')}</dd></div><div><dt className="text-xs text-zinc-600 dark:text-zinc-400">Plate number</dt><dd className="mt-1 break-all font-mono text-sm">{vehicle.plate_number}</dd></div><div><dt className="text-xs text-zinc-600 dark:text-zinc-400">Make</dt><dd className="mt-1 text-sm">{vehicle.make || 'Not provided'}</dd></div><div><dt className="text-xs text-zinc-600 dark:text-zinc-400">Model</dt><dd className="mt-1 text-sm">{vehicle.model || 'Not provided'}</dd></div><div><dt className="text-xs text-zinc-600 dark:text-zinc-400">Revision</dt><dd className="mt-1 text-sm">{vehicle.revision}</dd></div></dl><p className="mt-5 border-t border-zinc-200 pt-4 text-xs leading-5 text-zinc-600 dark:border-white/10 dark:text-zinc-400">These are the current saved details. The notification describes a past update and does not confirm document authenticity or reapproval.</p></section>
      <section className={`${panel} p-4 sm:p-5`} aria-labelledby="vehicle-documents-title"><h3 className="font-semibold" id="vehicle-documents-title">Vehicle documents</h3><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Private images load when you request a preview.</p><div className="mt-4"><VehicleDocumentCard courierId={courierId} document={vehicle.official_receipt} key={`or-${vehicle.revision}-${vehicle.official_receipt?.id ?? 'none'}`} kind="official_receipt" label="Official Receipt (OR)" /><VehicleDocumentCard courierId={courierId} document={vehicle.certificate_of_registration} key={`cr-${vehicle.revision}-${vehicle.certificate_of_registration?.id ?? 'none'}`} kind="certificate_of_registration" label="Certificate of Registration (CR)" /></div></section>
    </div> : null}
  </div>
}
