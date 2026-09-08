import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { FaArrowLeft, FaDownload, FaEye, FaPrint } from 'react-icons/fa6'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ActionButton, ErrorNotice, PrimaryButton, StatusLabel, field, link, manilaDate, panel } from '../components/PickupUi'
import { ApiError, csrf, pdf, request } from '../lib/api'
import type { CourierOption, Pickup, PickupSchedule } from '../types/pickups'

const toUtc = (value: string) => new Date(`${value}:00+08:00`).toISOString()
const localInput = (value: string) => new Intl.DateTimeFormat('sv-SE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(value)).replace(' ', 'T')

async function openPdf(path: string, mode: 'preview' | 'download' | 'print', filename: string) {
  const popup = mode === 'download' ? null : window.open('', '_blank')
  try {
    const blob = await pdf(path)
    const objectUrl = URL.createObjectURL(blob)
    if (mode === 'download') { const anchor = document.createElement('a'); anchor.href = objectUrl; anchor.download = filename; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000); return }
    if (!popup) throw new Error('Pop-up blocked')
    popup.location.href = objectUrl
    if (mode === 'print') popup.addEventListener('load', () => popup.print(), { once: true })
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 300_000)
  } catch (error) { popup?.close(); throw error }
}

export function PickupDetailPage() {
  const { pickupId = '' } = useParams()
  const navigate = useNavigate()
  const dialog = useRef<HTMLDialogElement>(null)
  const editDialog = useRef<HTMLDialogElement>(null)
  const cancelDialog = useRef<HTMLDialogElement>(null)
  const [pickup, setPickup] = useState<Pickup | null>(null)
  const [couriers, setCouriers] = useState<CourierOption[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [courierId, setCourierId] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [activeSchedule, setActiveSchedule] = useState<PickupSchedule | null>(null)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [pdfBusy, setPdfBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [detail, courierResult] = await Promise.all([request<{ data: Pickup }>(`/api/v1/logistics/pickups/${pickupId}`), request<{ data: CourierOption[] }>('/api/v1/logistics/pickup-couriers')])
      setPickup(detail.data); setCouriers(courierResult.data)
      setSelected((current) => current.filter((id) => detail.data.orders?.some((order) => order.id === id && !order.scheduled)))
      setCourierId((current) => current || (courierResult.data.length === 1 ? courierResult.data[0].id : ''))
    } catch (reason) { if (reason instanceof ApiError && reason.status === 404) navigate('/pickups', { replace: true }); else setError(reason instanceof ApiError ? reason.message : 'Pickup details could not be loaded.') }
    finally { setLoading(false) }
  }, [navigate, pickupId])
  useEffect(() => { document.title = 'Pickup details | Aisley Logistics'; void load() }, [load])
  const unscheduled = pickup?.orders?.filter((order) => !order.scheduled) ?? []
  const schedules = useMemo(() => Array.from(new Map((pickup?.orders ?? []).flatMap((order) => order.schedule ? [[order.schedule.id, order.schedule] as const] : [])).values()), [pickup])
  function toggle(id: string) { setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 30 ? [...current, id] : current) }
  function openCreate() { setReason(''); dialog.current?.showModal() }
  async function createSchedule() {
    if (!selected.length || !courierId || !startsAt || !endsAt) return
    setBusy(true); setError('')
    const storageKey = `logistics-pickup-schedule:${pickupId}:${[...selected].sort().join(':')}:${courierId}:${startsAt}:${endsAt}`
    let idempotencyKey = sessionStorage.getItem(storageKey)
    if (!idempotencyKey) { idempotencyKey = crypto.randomUUID(); sessionStorage.setItem(storageKey, idempotencyKey) }
    try { await csrf(); await request('/api/v1/logistics/pickup-schedules', { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify({ order_ids: selected, courier_id: courierId, starts_at: toUtc(startsAt), ends_at: toUtc(endsAt) }) }); sessionStorage.removeItem(storageKey); dialog.current?.close(); setSelected([]); setNotice('Pickup schedule created. The Seller and Courier will be notified.'); await load() }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : 'The schedule could not be created.'); dialog.current?.close(); if (reason instanceof ApiError && reason.status === 409) await load() }
    finally { setBusy(false) }
  }
  function beginEdit(schedule: PickupSchedule) { setActiveSchedule(schedule); setCourierId(schedule.courier_id); setStartsAt(localInput(schedule.starts_at)); setEndsAt(localInput(schedule.ends_at)); setReason(''); editDialog.current?.showModal() }
  async function revise(event: FormEvent) { event.preventDefault(); if (!activeSchedule) return; setBusy(true); setError(''); try { await csrf(); await request(`/api/v1/logistics/pickup-schedules/${activeSchedule.id}`, { method: 'PATCH', body: JSON.stringify({ expected_revision: activeSchedule.revision, reason, courier_id: courierId, starts_at: toUtc(startsAt), ends_at: toUtc(endsAt) }) }); editDialog.current?.close(); setNotice('Pickup schedule updated.'); await load() } catch (caught) { setError(caught instanceof ApiError ? caught.message : 'The schedule could not be updated.'); editDialog.current?.close(); await load() } finally { setBusy(false) } }
  async function cancel(event: FormEvent) { event.preventDefault(); if (!activeSchedule) return; setBusy(true); setError(''); try { await csrf(); await request(`/api/v1/logistics/pickup-schedules/${activeSchedule.id}/cancel`, { method: 'POST', body: JSON.stringify({ expected_revision: activeSchedule.revision, reason }) }); cancelDialog.current?.close(); setNotice('Pickup schedule cancelled. Its Orders can be scheduled again.'); await load() } catch (caught) { setError(caught instanceof ApiError ? caught.message : 'The schedule could not be cancelled.'); cancelDialog.current?.close(); await load() } finally { setBusy(false) } }
  async function waybill(orderId: string, reference: string, mode: 'preview' | 'download' | 'print') { setPdfBusy(`${orderId}:${mode}`); setError(''); try { await openPdf(`/api/v1/logistics/waybills/${orderId}.pdf?disposition=inline`, mode, `waybill-${reference}.pdf`) } catch (caught) { setError(caught instanceof ApiError ? caught.message : 'The waybill could not be opened. Allow pop-ups for preview or print and try again.') } finally { setPdfBusy('') } }

  if (loading && !pickup) return <div className="p-6 text-sm" role="status">Loading pickup details…</div>
  return <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <Link className={`${link} inline-flex items-center gap-2 text-sm`} to="/pickups"><FaArrowLeft aria-hidden="true" />Back to pickups</Link>
    {pickup ? <><div className="mt-4 flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 pb-4 dark:border-white/10"><div><div className="flex flex-wrap items-center gap-3"><h2 className="text-xl font-semibold">{pickup.shop.name}</h2><StatusLabel status={pickup.status} /></div><p className="mt-1 text-sm text-zinc-500">Ready {manilaDate(pickup.ready_at)} PHT · {pickup.order_count} {pickup.order_count === 1 ? 'Order' : 'Orders'}</p></div><ActionButton busy={loading} onClick={() => void load()}>Refresh</ActionButton></div>
      {error ? <div className="mt-4"><ErrorNotice message={error} retry={() => void load()} /></div> : null}{notice ? <p className="mt-4 border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200" role="status">{notice}</p> : null}
      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <section className={`${panel} overflow-hidden`}><div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-white/10"><div><h3 className="font-semibold">Orders</h3><p aria-live="polite" className="mt-0.5 text-xs text-zinc-500">Select up to 30 unscheduled Orders · {selected.length} selected</p></div><PrimaryButton disabled={!selected.length || couriers.length === 0} onClick={openCreate}>Schedule {selected.length || ''}</PrimaryButton></div>
          {unscheduled.length > 0 ? <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-sm dark:border-white/10 dark:bg-white/[0.03]"><label className="inline-flex items-center gap-2"><input type="checkbox" className="size-4 accent-[#4C1268]" checked={selected.length === Math.min(unscheduled.length, 30)} onChange={(event) => setSelected(event.target.checked ? unscheduled.slice(0, 30).map((order) => order.id) : [])} />Select first {Math.min(unscheduled.length, 30)} unscheduled</label></div> : null}
          <ul className="divide-y divide-zinc-200 dark:divide-white/10">{pickup.orders?.map((order) => <li className="grid gap-3 px-4 py-3 sm:grid-cols-[1.5rem_minmax(10rem,1fr)_auto] sm:items-center" key={order.id}><input aria-label={`Select ${order.reference}`} checked={selected.includes(order.id)} className="size-4 accent-[#4C1268]" disabled={order.scheduled} onChange={() => toggle(order.id)} type="checkbox" /><div><p className="font-medium">{order.reference}</p><p className="mt-0.5 text-xs text-zinc-500">{order.scheduled ? `Scheduled · ${order.schedule?.reference}` : 'Ready to schedule'}{order.waybill ? ` · ${order.waybill.reference}` : ' · Waybill unavailable'}</p></div>{order.waybill ? <div className="flex flex-wrap gap-1"><ActionButton aria-label={`Preview waybill ${order.waybill.reference}`} busy={pdfBusy === `${order.waybill.id}:preview`} onClick={() => void waybill(order.waybill!.id, order.waybill!.reference, 'preview')}><FaEye aria-hidden="true" />Preview</ActionButton><ActionButton aria-label={`Download waybill ${order.waybill.reference}`} busy={pdfBusy === `${order.waybill.id}:download`} onClick={() => void waybill(order.waybill!.id, order.waybill!.reference, 'download')}><FaDownload aria-hidden="true" /></ActionButton><ActionButton aria-label={`Print waybill ${order.waybill.reference}`} busy={pdfBusy === `${order.waybill.id}:print`} onClick={() => void waybill(order.waybill!.id, order.waybill!.reference, 'print')}><FaPrint aria-hidden="true" /></ActionButton></div> : null}</li>)}</ul>
        </section>
        <aside className="space-y-4"><section className={`${panel} p-4`}><h3 className="font-semibold">Pickup origin</h3><p className="mt-2 text-sm leading-6">{pickup.shop.pickup_area ? [pickup.shop.pickup_area.city_municipality, pickup.shop.pickup_area.province, pickup.shop.pickup_area.region].join(', ') : 'Area unavailable'}</p></section><section className={`${panel} p-4`}><h3 className="font-semibold">Schedules</h3>{schedules.length ? <ul className="mt-3 divide-y divide-zinc-200 dark:divide-white/10">{schedules.map((schedule) => <li className="py-3 first:pt-0 last:pb-0" key={schedule.id}><div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">{schedule.reference}</span><StatusLabel status={schedule.status} /></div><p className="mt-1 text-xs leading-5 text-zinc-500">{manilaDate(schedule.starts_at)}–{new Intl.DateTimeFormat('en-PH', { timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(schedule.ends_at))} PHT<br />{couriers.find((courier) => courier.id === schedule.courier_id)?.name || 'Assigned Courier'}</p>{schedule.status === 'scheduled' ? <div className="mt-2 flex gap-3 text-sm"><button className={link} onClick={() => beginEdit(schedule)} type="button">Edit</button><button className="font-medium text-red-700 hover:underline dark:text-red-300" onClick={() => { setActiveSchedule(schedule); setReason(''); cancelDialog.current?.showModal() }} type="button">Cancel</button></div> : null}</li>)}</ul> : <p className="mt-2 text-sm text-zinc-500">No pickup window has been scheduled.</p>}</section>{couriers.length === 0 ? <section className="border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200"><h3 className="font-semibold">No eligible Courier</h3><p className="mt-1">Approve and activate a Courier before scheduling this pickup.</p></section> : null}</aside>
      </div>
    </> : null}
    <ScheduleDialog dialog={dialog} busy={busy} couriers={couriers} courierId={courierId} setCourierId={setCourierId} startsAt={startsAt} setStartsAt={setStartsAt} endsAt={endsAt} setEndsAt={setEndsAt} title="Confirm pickup schedule" description={`${selected.length} ${selected.length === 1 ? 'Order' : 'Orders'} will be assigned. The Seller and Courier will be notified.`} submitLabel="Create schedule" submit={() => void createSchedule()} />
    <dialog ref={editDialog} className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-lg border border-zinc-200 bg-white p-0 text-zinc-950 backdrop:bg-black/55 dark:border-white/15 dark:bg-[#18181b] dark:text-white"><form className="p-5" onSubmit={revise}><h3 className="text-lg font-semibold">Edit pickup schedule</h3><ScheduleFields couriers={couriers} courierId={courierId} setCourierId={setCourierId} startsAt={startsAt} setStartsAt={setStartsAt} endsAt={endsAt} setEndsAt={setEndsAt} /><label className="mt-3 block text-sm font-medium" htmlFor="edit-reason">Reason</label><textarea className={`${field} mt-1 h-20 py-2`} id="edit-reason" maxLength={1000} required value={reason} onChange={(event) => setReason(event.target.value)} /><div className="mt-5 flex justify-end gap-2"><ActionButton onClick={() => editDialog.current?.close()}>Keep current</ActionButton><PrimaryButton busy={busy} type="submit">Save changes</PrimaryButton></div></form></dialog>
    <dialog ref={cancelDialog} className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-zinc-200 bg-white p-5 text-zinc-950 backdrop:bg-black/55 dark:border-white/15 dark:bg-[#18181b] dark:text-white"><form onSubmit={cancel}><h3 className="text-lg font-semibold">Cancel pickup schedule?</h3><p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">The Seller and Courier will be notified. The Orders can be scheduled again.</p><label className="mt-3 block text-sm font-medium" htmlFor="cancel-reason">Reason</label><textarea className={`${field} mt-1 h-20 py-2`} id="cancel-reason" maxLength={1000} required value={reason} onChange={(event) => setReason(event.target.value)} /><div className="mt-5 flex justify-end gap-2"><ActionButton onClick={() => cancelDialog.current?.close()}>Keep schedule</ActionButton><ActionButton busy={busy} className="border-red-700! bg-red-700! text-white hover:bg-red-800!" type="submit">Cancel schedule</ActionButton></div></form></dialog>
  </div>
}

function ScheduleFields({ couriers, courierId, setCourierId, startsAt, setStartsAt, endsAt, setEndsAt }: { couriers: CourierOption[]; courierId: string; setCourierId: (value: string) => void; startsAt: string; setStartsAt: (value: string) => void; endsAt: string; setEndsAt: (value: string) => void }) { return <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium sm:col-span-2">Courier<select className={`${field} mt-1`} required value={courierId} onChange={(event) => setCourierId(event.target.value)}><option value="">Select an eligible Courier</option>{couriers.map((courier) => <option key={courier.id} value={courier.id}>{courier.name || 'Courier'} · {courier.email}</option>)}</select></label><label className="text-sm font-medium">Starts (PHT)<input className={`${field} mt-1`} min={localInput(new Date(Date.now() + 60_000).toISOString())} required type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label><label className="text-sm font-medium">Ends (PHT)<input className={`${field} mt-1`} min={startsAt} required type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} /></label></div> }
function ScheduleDialog({ dialog, busy, title, description, submitLabel, submit, ...fields }: React.ComponentProps<typeof ScheduleFields> & { dialog: React.RefObject<HTMLDialogElement | null>; busy: boolean; title: string; description: string; submitLabel: string; submit: () => void }) { return <dialog ref={dialog} className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-lg border border-zinc-200 bg-white p-5 text-zinc-950 backdrop:bg-black/55 dark:border-white/15 dark:bg-[#18181b] dark:text-white"><h3 className="text-lg font-semibold">{title}</h3><p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{description}</p><ScheduleFields {...fields} /><p className="mt-3 text-xs text-zinc-500">Times are entered in Philippine Time (Asia/Manila) and stored as UTC.</p><div className="mt-5 flex justify-end gap-2"><ActionButton onClick={() => dialog.current?.close()}>Cancel</ActionButton><PrimaryButton busy={busy} onClick={submit}>{submitLabel}</PrimaryButton></div></dialog> }
