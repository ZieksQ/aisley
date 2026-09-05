import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { FaArrowLeft, FaPlus, FaXmark } from 'react-icons/fa6'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ApiError, apiRequest } from '../lib/api'
import type { HomepageAd, HomepageConfiguration } from '../types/homepageAdvertisements'

const inputClass = 'mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#E6007A] focus:ring-3 focus:ring-pink-100 dark:border-white/15 dark:bg-[#171921] dark:focus:ring-pink-500/10'

function blankAd(slot: HomepageAd['slot'] = 'primary'): HomepageAd {
  return { slot, position: 0, image_desktop_path: '', image_desktop_filename: '', image_mobile_path: '', image_mobile_filename: '', destination_url: '', is_active: true }
}

function dateTimeInput(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function adsForLayout(layout: HomepageConfiguration['layout'], current: HomepageAd[]) {
  const primary = current.filter((ad) => ad.slot === 'primary')
  while (primary.length < (layout.includes('carousel') ? 2 : 1)) primary.push(blankAd())
  const top = current.find((ad) => ad.slot === 'secondary_top') ?? blankAd('secondary_top')
  const bottom = current.find((ad) => ad.slot === 'secondary_bottom') ?? blankAd('secondary_bottom')
  const ads = layout === 'single' ? [primary[0]] : layout === 'carousel' ? primary : layout === 'multi_block' ? [primary[0], top, bottom] : [...primary, top, bottom]
  return ads.map((ad, position) => ({ ...ad, position }))
}

export function HomepageAdvertisementEditorPage() {
  const { configurationId } = useParams()
  const navigate = useNavigate()
  const { admin } = useAuth()
  const isNew = !configurationId
  const [form, setForm] = useState<HomepageConfiguration>({ id: '', tag_title: '', layout: 'single', rotation_interval_seconds: 6, starts_at: '', ends_at: '', status: 'draft', revision: 1, ads: [blankAd()] })
  const [loading, setLoading] = useState(!isNew)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const canManage = admin?.permissions.includes('platform-settings.manage') ?? false

  useEffect(() => {
    document.title = `${isNew ? 'New' : 'Edit'} homepage advertisement | Aisley Admin`
    if (!configurationId) return
    const controller = new AbortController()
    apiRequest<{ data: HomepageConfiguration }>(`/api/v1/admin/platform-settings/homepage-advertisements/${configurationId}`, { signal: controller.signal })
      .then(({ data }) => {
        if (data.status !== 'draft') throw new Error('Published layouts are immutable. Use Edit from the homepage ads list to create a draft copy.')
        setForm({ ...data, tag_title: data.tag_title ?? '', starts_at: dateTimeInput(data.starts_at), ends_at: dateTimeInput(data.ends_at), ads: data.ads.map((ad) => ({ ...ad, image_desktop_filename: ad.image_desktop_filename ?? '', image_mobile_filename: ad.image_mobile_filename ?? '' })) })
      })
      .catch((caught) => { if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : 'Unable to load this advertisement layout.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [configurationId, isNew])

  function updateAd(index: number, patch: Partial<HomepageAd>) {
    setForm((current) => ({ ...current, ads: current.ads.map((ad, adIndex) => adIndex === index ? { ...ad, ...patch } : ad) }))
  }

  function assignSlot(index: number, slot: HomepageAd['slot']) {
    setForm((current) => {
      if (current.ads[index].slot === slot) return current
      const ads = [...current.ads]
      const previous = ads[index].slot
      const swap = ads.findIndex((ad, adIndex) => adIndex !== index && ad.slot === slot)
      ads[index] = { ...ads[index], slot }
      if (swap >= 0) ads[swap] = { ...ads[swap], slot: previous }
      return { ...current, ads }
    })
  }

  async function upload(file: File, index: number, mobile: boolean) {
    const key = `${index}-${mobile ? 'mobile' : 'desktop'}`
    setUploading(key)
    setError('')
    try {
      const body = new FormData()
      body.append('image', file)
      const response = await apiRequest<{ data: { path: string; filename: string } }>('/api/v1/admin/platform-settings/homepage-advertisement-images', { method: 'POST', body })
      updateAd(index, mobile
        ? { image_mobile_path: response.data.path, image_mobile_filename: response.data.filename }
        : { image_desktop_path: response.data.path, image_desktop_filename: response.data.filename })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Image upload failed.')
    } finally {
      setUploading(null)
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setFieldErrors({})
    try {
      const ads = form.ads.map((ad, position) => ({ ...ad, position, id: ad.id || undefined, image_mobile_path: ad.image_mobile_path || null, image_desktop_filename: ad.image_desktop_filename || null, image_mobile_filename: ad.image_mobile_filename || null, destination_url: ad.destination_url || null }))
      await apiRequest(isNew ? '/api/v1/admin/platform-settings/homepage-advertisements' : `/api/v1/admin/platform-settings/homepage-advertisements/${form.id}`, { method: isNew ? 'POST' : 'PATCH', body: JSON.stringify({ ...form, tag_title: form.tag_title.trim(), starts_at: form.starts_at || null, ends_at: form.ends_at || null, ads, ...(!isNew ? { revision: form.revision } : {}) }) })
      navigate('/platform-settings?section=advertisements', { replace: true })
    } catch (caught) {
      if (caught instanceof ApiError) setFieldErrors(caught.errors)
      setError(caught instanceof Error ? caught.message : 'Unable to save this advertisement layout.')
    } finally {
      setBusy(false)
    }
  }

  if (!canManage) return <div className="mx-auto max-w-3xl px-5 py-10"><p className="text-sm text-slate-500">You do not have permission to manage homepage advertisements.</p></div>
  if (loading) return <div className="mx-auto max-w-5xl px-5 py-10 text-sm text-slate-500">Loading advertisement layout…</div>

  return <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
    <Link className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white" to="/platform-settings?section=advertisements"><FaArrowLeft />Back to homepage ads</Link>
    <div className="mt-5 border-b border-slate-200 pb-5 dark:border-white/10"><h2 className="text-2xl font-semibold tracking-tight">{isNew ? 'New advertisement layout' : 'Edit advertisement layout'}</h2><p className="mt-2 text-sm text-slate-500">Changes remain a draft until you publish them from the homepage ads list.</p></div>
    {error ? <p className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200" role="alert">{error}</p> : null}
    <form className="mt-6 space-y-6" onSubmit={save}>
      <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.035] sm:grid-cols-2">
        <label className="text-sm font-medium sm:col-span-2">Advertisement title (internal tag)<input className={inputClass} maxLength={120} placeholder="e.g. September homepage promotion" value={form.tag_title} onChange={(event) => setForm({ ...form, tag_title: event.target.value })} /><span className="mt-1 block text-xs font-normal text-slate-500">Used only to identify this advertisement in Admin. It is never shown on the homepage.</span></label>
        <label className="text-sm font-medium">Layout<select className={inputClass} value={form.layout} onChange={(event) => { const layout = event.target.value as HomepageConfiguration['layout']; setForm({ ...form, layout, ads: adsForLayout(layout, form.ads) }) }}><option value="single">Single</option><option value="carousel">Carousel</option><option value="multi_block">Multi block</option><option value="multi_block_carousel">Multi block carousel</option></select></label>
        <label className="text-sm font-medium">Rotation interval (seconds)<input className={inputClass} min="3" max="20" type="number" value={form.rotation_interval_seconds} onChange={(event) => setForm({ ...form, rotation_interval_seconds: Number(event.target.value) })} /></label>
        <label className="text-sm font-medium">Schedule starts (optional)<input className={inputClass} type="datetime-local" value={form.starts_at} onChange={(event) => setForm({ ...form, starts_at: event.target.value })} /></label>
        <label className="text-sm font-medium">Schedule ends (optional)<input className={inputClass} min={form.starts_at || undefined} type="datetime-local" value={form.ends_at} onChange={(event) => setForm({ ...form, ends_at: event.target.value })} /></label>
        <p className="text-xs leading-5 text-slate-500 sm:col-span-2">Scheduling applies to the complete advertisement layout, including every block and carousel slide.</p>
      </div>
      {form.ads.map((ad, index) => {
        const primaryCount = form.ads.filter((item) => item.slot === 'primary').length
        const canRemove = ad.slot === 'primary' && form.layout.includes('carousel') && primaryCount > 2
        return <fieldset className="rounded-lg border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.035]" key={`${ad.id ?? 'new'}-${index}`}><legend className="px-2 text-sm font-semibold">Advertisement {index + 1}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">Placement<select className={inputClass} disabled={form.layout === 'single' || form.layout === 'carousel'} value={ad.slot} onChange={(event) => assignSlot(index, event.target.value as HomepageAd['slot'])}><option value="primary">{form.layout.includes('carousel') ? 'Primary carousel' : 'Primary block'}</option>{form.layout.startsWith('multi_block') ? <><option value="secondary_top">Secondary top block</option><option value="secondary_bottom">Secondary bottom block</option></> : null}</select></label>
            <label className="flex items-center gap-2 self-end pb-3 text-sm"><input checked={ad.is_active} onChange={(event) => updateAd(index, { is_active: event.target.checked })} type="checkbox" />Active</label>
            <label className="text-sm font-medium sm:col-span-2">Destination URL (optional)<input className={inputClass} placeholder="/search or https://example.com" value={ad.destination_url} onChange={(event) => updateAd(index, { destination_url: event.target.value })} /></label>
            <ImageUpload ad={ad} index={index} label="Insert desktop image" loading={uploading === `${index}-desktop`} mobile={false} onUpload={upload} required />
            <ImageUpload ad={ad} index={index} label="Insert mobile image (optional)" loading={uploading === `${index}-mobile`} mobile onUpload={upload} />
          </div>
          {Object.entries(fieldErrors).filter(([key]) => key.startsWith(`ads.${index}.`)).flatMap(([, messages]) => messages).map((message) => <p className="mt-3 text-sm text-red-600" key={message}>{message}</p>)}
          {canRemove ? <button className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-red-600" onClick={() => setForm({ ...form, ads: form.ads.filter((_, adIndex) => adIndex !== index) })} type="button"><FaXmark />Remove slide</button> : null}
        </fieldset>
      })}
      {form.layout.includes('carousel') ? <button className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold hover:bg-slate-50 dark:border-white/15 dark:hover:bg-white/5" onClick={() => setForm({ ...form, ads: [...form.ads, blankAd()] })} type="button"><FaPlus />Add carousel slide</button> : null}
      <div className="flex justify-end gap-3 border-t border-slate-200 pt-5 dark:border-white/10"><Link className="inline-flex h-10 items-center rounded-lg border border-slate-300 px-4 text-sm font-semibold dark:border-white/15" to="/platform-settings?section=advertisements">Cancel</Link><button className="h-10 rounded-lg bg-[#4C1268] px-4 text-sm font-semibold text-white hover:bg-[#3d0e54] disabled:opacity-50" disabled={busy || uploading !== null} type="submit">{busy ? 'Saving…' : 'Save draft'}</button></div>
    </form>
  </div>
}

function ImageUpload({ ad, index, label, loading, mobile, onUpload, required = false }: { ad: HomepageAd; index: number; label: string; loading: boolean; mobile: boolean; onUpload: (file: File, index: number, mobile: boolean) => Promise<void>; required?: boolean }) {
  const path = mobile ? ad.image_mobile_path : ad.image_desktop_path
  const filename = mobile ? ad.image_mobile_filename : ad.image_desktop_filename
  const storedName = filename || path.split('/').at(-1)

  return <div className="text-sm font-medium"><span>{label}</span><input accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" className={`${inputClass} file:mr-3 file:border-0 file:bg-transparent file:font-medium`} disabled={loading} onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ''; if (file) void onUpload(file, index, mobile) }} required={required && !path} type="file" /><p className="mt-1 text-xs font-normal text-slate-500">{loading ? 'Uploading image…' : storedName ? `Inserted: ${storedName}` : mobile ? 'Optional. The desktop image is used when omitted.' : 'JPEG, PNG, or WebP — 10 MB maximum.'}</p></div>
}
