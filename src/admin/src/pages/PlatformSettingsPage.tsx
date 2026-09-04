import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { FaBullhorn, FaEye, FaFileLines, FaImage, FaPen, FaPlus, FaXmark } from 'react-icons/fa6'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ApiError, apiRequest } from '../lib/api'
import type { Announcement, Paginated, Policy, PolicyType, PolicyVersion } from '../types/platformSettings'

type PreviewContent = { title: string; body: string } | null

export function PlatformSettingsPage() {
  const { admin } = useAuth()
  const [params, setParams] = useSearchParams()
  const section = ['policies', 'advertisements'].includes(params.get('section') ?? '') ? params.get('section')! : 'announcements'
  const canManage = admin?.permissions.includes('platform-settings.manage') ?? false

  useEffect(() => { document.title = 'Platform settings | Aisley Admin' }, [])

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
      <div className="border-b border-slate-200 pb-5 dark:border-white/10">
        <h2 className="text-2xl font-semibold tracking-tight">Platform settings</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Publish platform announcements and maintain versioned policy content.</p>
      </div>
      <div className="mt-6 flex gap-5 border-b border-slate-200 dark:border-white/10" role="tablist" aria-label="Platform settings sections">
        <button aria-selected={section === 'announcements'} className={tabClass(section === 'announcements')} onClick={() => setParams({ section: 'announcements' })} role="tab"><span className="inline-flex items-center gap-2"><FaBullhorn />Announcements</span></button>
        <button aria-selected={section === 'policies'} className={tabClass(section === 'policies')} onClick={() => setParams({ section: 'policies' })} role="tab"><span className="inline-flex items-center gap-2"><FaFileLines />Policies</span></button>
        <button aria-selected={section === 'advertisements'} className={tabClass(section === 'advertisements')} onClick={() => setParams({ section: 'advertisements' })} role="tab"><span className="inline-flex items-center gap-2"><FaImage />Homepage ads</span></button>
      </div>
      {section === 'announcements' ? <Announcements canManage={canManage} /> : section === 'policies' ? <Policies canManage={canManage} /> : <HomepageAdvertisements canManage={canManage} />}
    </div>
  )
}

type HomepageAd = { id?: string; slot: 'primary' | 'secondary_top' | 'secondary_bottom'; position: number; title: string; description: string; image_desktop_path: string; image_mobile_path: string; alt_text: string; destination_url: string; starts_at: string; ends_at: string; is_active: boolean }
type HomepageConfiguration = { id: string; layout: 'single' | 'carousel' | 'multi_block' | 'multi_block_carousel'; rotation_interval_seconds: number; status: string; revision: number; ads: HomepageAd[] }
const blankAd = (slot: HomepageAd['slot'] = 'primary', position = 0): HomepageAd => ({ slot, position, title: '', description: '', image_desktop_path: '', image_mobile_path: '', alt_text: '', destination_url: '', starts_at: '', ends_at: '', is_active: true })

function HomepageAdvertisements({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<HomepageConfiguration[]>([]); const [editing, setEditing] = useState<HomepageConfiguration | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  const load = () => apiRequest<Paginated<HomepageConfiguration>>('/api/v1/admin/platform-settings/homepage-advertisements').then((response) => setItems(response.data)).catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load homepage advertisements.'))
  useEffect(() => { void load() }, [])
  const open = (item?: HomepageConfiguration) => setEditing(item ?? { id: '', layout: 'single', rotation_interval_seconds: 6, status: 'draft', revision: 1, ads: [blankAd()] })
  const save = async (event: FormEvent) => { event.preventDefault(); if (!editing) return; setBusy(true); setError(''); try { const payload = { ...editing, ads: editing.ads.map((ad) => ({ ...ad, id: ad.id || undefined, description: ad.description || null, image_mobile_path: ad.image_mobile_path || null, destination_url: ad.destination_url || null, starts_at: ad.starts_at || null, ends_at: ad.ends_at || null })) }; await apiRequest(editing.id ? `/api/v1/admin/platform-settings/homepage-advertisements/${editing.id}` : '/api/v1/admin/platform-settings/homepage-advertisements', { method: editing.id ? 'PATCH' : 'POST', body: JSON.stringify(editing.id ? { ...payload, revision: editing.revision } : payload) }); setEditing(null); void load() } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to save advertisement draft.') } finally { setBusy(false) } }
  const publish = async (item: HomepageConfiguration) => { if (!window.confirm('Publish this homepage advertisement layout now?')) return; try { await apiRequest(`/api/v1/admin/platform-settings/homepage-advertisements/${item.id}/publish`, { method: 'POST', body: JSON.stringify({ revision: item.revision }) }); void load() } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to publish.') } }
  const upload = async (file: File, index: number) => { if (!editing) return; setBusy(true); setError(''); try { const body = new FormData(); body.append('image', file); const response = await apiRequest<{ data: { url: string } }>('/api/v1/admin/platform-settings/homepage-advertisement-images', { method: 'POST', body }); const ads = [...editing.ads]; ads[index] = { ...ads[index], image_desktop_path: response.data.url }; setEditing({ ...editing, ads }) } catch (caught) { setError(caught instanceof Error ? caught.message : 'Image upload failed.') } finally { setBusy(false) } }
  return <section className="mt-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="font-semibold">Homepage advertisements</h3><p className="mt-1 text-sm text-slate-500">Draft a layout, schedule each ad, then publish it immediately.</p></div>{canManage ? <PrimaryButton onClick={() => open()}><FaPlus />New layout</PrimaryButton> : null}</div>{error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}<div className="mt-5 space-y-3">{items.map((item) => <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4 dark:border-white/10" key={item.id}><div><p className="font-medium capitalize">{item.layout.replaceAll('_', ' ')}</p><p className="text-sm text-slate-500">{item.ads.length} ads · {item.status}</p></div>{canManage ? <div className="flex gap-2"><button className="text-sm text-[#A50059]" onClick={() => open(item)} type="button">Edit</button>{item.status === 'draft' ? <button className="text-sm font-medium text-[#A50059]" onClick={() => void publish(item)} type="button">Publish now</button> : null}</div> : null}</div>)}</div>{editing ? <form className="mt-6 space-y-4 rounded-xl border border-slate-200 p-4 dark:border-white/10" onSubmit={save}><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Layout<select className={inputClass} value={editing.layout} onChange={(event) => setEditing({ ...editing, layout: event.target.value as HomepageConfiguration['layout'] })}><option value="single">Single</option><option value="carousel">Carousel</option><option value="multi_block">Multi block</option><option value="multi_block_carousel">Multi block carousel</option></select></label><label className="text-sm">Rotation seconds<input className={inputClass} min="3" max="20" type="number" value={editing.rotation_interval_seconds} onChange={(event) => setEditing({ ...editing, rotation_interval_seconds: Number(event.target.value) })} /></label></div>{editing.ads.map((ad, index) => <div className="grid gap-2 border-t pt-3 sm:grid-cols-2" key={`${ad.id ?? 'new'}-${index}`}><input className={inputClass} placeholder="Title" value={ad.title} onChange={(event) => { const ads = [...editing.ads]; ads[index] = { ...ad, title: event.target.value }; setEditing({ ...editing, ads }) }} /><input className={inputClass} placeholder="Desktop image URL" value={ad.image_desktop_path} onChange={(event) => { const ads = [...editing.ads]; ads[index] = { ...ad, image_desktop_path: event.target.value }; setEditing({ ...editing, ads }) }} /><input className={inputClass} placeholder="Alt text" value={ad.alt_text} onChange={(event) => { const ads = [...editing.ads]; ads[index] = { ...ad, alt_text: event.target.value }; setEditing({ ...editing, ads }) }} /><input className={inputClass} placeholder="Destination URL (optional)" value={ad.destination_url} onChange={(event) => { const ads = [...editing.ads]; ads[index] = { ...ad, destination_url: event.target.value }; setEditing({ ...editing, ads }) }} /></div>)}<div className="flex gap-3"><PrimaryButton disabled={busy} type="submit">Save draft</PrimaryButton><button className="text-sm" onClick={() => setEditing(null)} type="button">Cancel</button></div></form> : null}</section>
}

function Announcements({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<Announcement[]>([])
  const [status, setStatus] = useState('')
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [form, setForm] = useState({ title: '', body: '', expires_at: '' })
  const [showForm, setShowForm] = useState(false)
  const [preview, setPreview] = useState<PreviewContent>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [reload, setReload] = useState(0)

  useEffect(() => {
    setLoading(true)
    setError('')
    const query = status ? `?status=${status}` : ''
    apiRequest<Paginated<Announcement>>(`/api/v1/admin/platform-settings/announcements${query}`)
      .then((response) => setItems(response.data))
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load announcements.'))
      .finally(() => setLoading(false))
  }, [reload, status])

  function openCreate() {
    setEditing(null)
    setForm({ title: '', body: '', expires_at: '' })
    setFieldErrors({})
    setShowForm(true)
  }

  function openEdit(item: Announcement) {
    setEditing(item)
    setForm({ title: item.title, body: item.body, expires_at: item.expires_at ? item.expires_at.slice(0, 16) : '' })
    setFieldErrors({})
    setShowForm(true)
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setFieldErrors({})
    try {
      const payload = { ...form, expires_at: form.expires_at || null, ...(editing ? { revision: editing.revision } : {}) }
      await apiRequest(editing ? `/api/v1/admin/platform-settings/announcements/${editing.id}` : '/api/v1/admin/platform-settings/announcements', { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(payload) })
      setShowForm(false)
      setEditing(null)
      setReload((value) => value + 1)
    } catch (caught) {
      if (caught instanceof ApiError) {
        setFieldErrors(caught.errors)
        setError(caught.status === 409 ? 'This announcement changed. The latest list has been loaded; review it before editing again.' : caught.message)
        if (caught.status === 409) { setShowForm(false); setEditing(null); setReload((value) => value + 1) }
      } else setError('Unable to save the announcement.')
    } finally { setBusy(false) }
  }

  async function transition(item: Announcement, action: 'publish' | 'archive') {
    const question = action === 'publish' ? `Publish “${item.title}” to the platform feed?` : `Archive “${item.title}” and remove it from the platform feed?`
    if (!window.confirm(question)) return
    setBusy(true)
    setError('')
    try {
      await apiRequest(`/api/v1/admin/platform-settings/announcements/${item.id}/${action}`, { method: 'POST', body: JSON.stringify({ revision: item.revision }) })
      setReload((value) => value + 1)
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status === 409 ? 'This announcement changed. The list has been refreshed.' : caught instanceof Error ? caught.message : `Unable to ${action} announcement.`)
      setReload((value) => value + 1)
    } finally { setBusy(false) }
  }

  return (
    <section className="mt-6" aria-labelledby="announcements-heading">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold" id="announcements-heading">Announcements</h3><p className="mt-1 text-sm text-slate-500">Only published, unexpired announcements appear in user-facing feeds.</p></div>{canManage ? <PrimaryButton onClick={openCreate}><FaPlus />New announcement</PrimaryButton> : null}</div>
      {error ? <ErrorMessage message={error} onRetry={() => setReload((value) => value + 1)} /> : null}
      {showForm ? (
        <form className={panelClass} onSubmit={save}>
          <FormHeader title={editing ? 'Edit announcement draft' : 'New announcement draft'} onCancel={() => setShowForm(false)} />
          <div className="mt-4 grid gap-4">
            <Field label="Title" error={fieldErrors.title?.[0]}><input className={inputClass} maxLength={160} onChange={(event) => setForm({ ...form, title: event.target.value })} required value={form.title} /></Field>
            <Field label="Content" error={fieldErrors.body?.[0]}><textarea className={`${inputClass} min-h-36 py-3`} maxLength={20000} onChange={(event) => setForm({ ...form, body: event.target.value })} required value={form.body} /></Field>
            <Field label="Expiration (optional)" error={fieldErrors.expires_at?.[0]}><input className={inputClass} onChange={(event) => setForm({ ...form, expires_at: event.target.value })} type="datetime-local" value={form.expires_at} /></Field>
          </div>
          <FormActions busy={busy} onPreview={() => setPreview({ title: form.title || 'Untitled announcement', body: form.body })} />
        </form>
      ) : null}
      <div className={`${panelClass} overflow-hidden p-0`}>
        <div className="border-b border-slate-200 p-4 dark:border-white/10"><select aria-label="Filter announcements" className={`${inputClass} max-w-48`} onChange={(event) => setStatus(event.target.value)} value={status}><option value="">All statuses</option><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></div>
        {loading ? <p className="p-5 text-sm text-slate-500">Loading announcements…</p> : items.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No announcements in this view.</p> : (
          <div className="divide-y divide-slate-200 dark:divide-white/10">{items.map((item) => (
            <article className="p-5" key={item.id}><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold">{item.title}</h4><Status value={item.status} /></div><p className="mt-2 line-clamp-2 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{item.body}</p><p className="mt-2 text-xs text-slate-400">Updated {formatDate(item.updated_at)}{item.expires_at ? ` · Expires ${formatDate(item.expires_at)}` : ''}</p></div><div className="flex shrink-0 gap-3 text-sm font-semibold"><button className={secondaryTextButtonClass} onClick={() => setPreview({ title: item.title, body: item.body })}><FaEye />Preview</button>{canManage && item.status === 'draft' ? <><button className={secondaryTextButtonClass} onClick={() => openEdit(item)}><FaPen />Edit</button><button className={primaryTextButtonClass} disabled={busy} onClick={() => void transition(item, 'publish')}>Publish</button></> : null}{canManage && item.status === 'published' ? <button className="text-rose-700 dark:text-rose-300" disabled={busy} onClick={() => void transition(item, 'archive')}>Archive</button> : null}</div></div></article>
          ))}</div>
        )}
      </div>
      {preview ? <PreviewDialog content={preview} onClose={() => setPreview(null)} /> : null}
    </section>
  )
}

function Policies({ canManage }: { canManage: boolean }) {
  const [policies, setPolicies] = useState<Policy[]>([])
  const [selectedType, setSelectedType] = useState<PolicyType>('terms_of_service')
  const [editing, setEditing] = useState<PolicyVersion | null>(null)
  const [editorKind, setEditorKind] = useState<'new' | 'draft' | 'successor'>('new')
  const [form, setForm] = useState({ title: '', content: '', change_summary: '', requires_reconsent: false })
  const [showForm, setShowForm] = useState(false)
  const [preview, setPreview] = useState<PreviewContent>(null)
  const [historyVersion, setHistoryVersion] = useState<PolicyVersion | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [reload, setReload] = useState(0)

  useEffect(() => {
    setLoading(true)
    setError('')
    apiRequest<{ data: Policy[] }>('/api/v1/admin/platform-settings/policies').then((response) => setPolicies(response.data)).catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load policies.')).finally(() => setLoading(false))
  }, [reload])

  const policy = policies.find((item) => item.type === selectedType)
  const current = policy?.versions.find((version) => version.id === policy.current_version_id) ?? null
  const drafts = policy?.versions.filter((version) => version.status === 'draft') ?? []
  const history = policy?.versions.filter((version) => version.status !== 'draft') ?? []

  function openCreate() { setEditing(null); setEditorKind('new'); setForm({ title: policy?.label ?? '', content: '', change_summary: '', requires_reconsent: false }); setFieldErrors({}); setShowForm(true) }
  function openDraft(version: PolicyVersion, kind: 'draft' | 'successor' = 'draft') { setEditing(version); setEditorKind(kind); setForm({ title: version.title, content: version.content, change_summary: version.change_summary ?? '', requires_reconsent: version.requires_reconsent }); setFieldErrors({}); setShowForm(true) }

  async function editPublished(version: PolicyVersion) {
    if (!window.confirm(`Edit published version ${version.version}? Its published content will remain unchanged and a new draft will be created.`)) return
    setBusy(true)
    setError('')
    try {
      const response = await apiRequest<{ data: PolicyVersion }>(`/api/v1/admin/platform-settings/policy-versions/${version.id}/successor`, { method: 'POST', body: JSON.stringify({}) })
      openDraft(response.data, 'successor')
      setReload((value) => value + 1)
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status === 409 ? 'The current policy changed. The latest versions have been loaded.' : caught instanceof Error ? caught.message : 'Unable to create a successor draft.')
      setReload((value) => value + 1)
    } finally { setBusy(false) }
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setFieldErrors({})
    try {
      await apiRequest(editing ? `/api/v1/admin/platform-settings/policy-versions/${editing.id}` : `/api/v1/admin/platform-settings/policies/${selectedType}/versions`, { method: editing ? 'PATCH' : 'POST', body: JSON.stringify({ ...form, change_summary: form.change_summary || null, ...(editing ? { revision: editing.revision } : {}) }) })
      setShowForm(false)
      setEditing(null)
      setReload((value) => value + 1)
    } catch (caught) {
      if (caught instanceof ApiError) {
        setFieldErrors(caught.errors)
        setError(caught.status === 409 ? 'This policy draft changed. The latest version has been loaded; review it before editing again.' : caught.message)
        if (caught.status === 409) { setShowForm(false); setEditing(null); setReload((value) => value + 1) }
      } else setError('Unable to save policy draft.')
    } finally { setBusy(false) }
  }

  async function publish(version: PolicyVersion) {
    const warning = version.requires_reconsent ? ' This version is marked as requiring user re-consent.' : ''
    if (!window.confirm(`Publish version ${version.version}? The current version will be preserved as superseded.${warning}`)) return
    setBusy(true)
    setError('')
    try {
      await apiRequest(`/api/v1/admin/platform-settings/policy-versions/${version.id}/publish`, { method: 'POST', body: JSON.stringify({ revision: version.revision }) })
      setShowForm(false)
      setEditing(null)
      setReload((value) => value + 1)
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status === 409 ? 'This policy changed. The latest versions have been loaded.' : caught instanceof Error ? caught.message : 'Unable to publish policy.')
      setReload((value) => value + 1)
    } finally { setBusy(false) }
  }

  return (
    <section className="mt-6" aria-labelledby="policies-heading">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="font-semibold" id="policies-heading">Policies</h3><p className="mt-1 text-sm text-slate-500">Published versions are immutable. Editing one creates a separate successor draft.</p></div>{canManage ? <PrimaryButton onClick={openCreate}><FaPlus />New version</PrimaryButton> : null}</div>
      <div className="mt-5 flex gap-5 overflow-x-auto border-b border-slate-200 dark:border-white/10" role="tablist" aria-label="Policy types">{policies.map((item) => <button aria-selected={selectedType === item.type} className={tabClass(selectedType === item.type)} key={item.type} onClick={() => { setSelectedType(item.type); setShowForm(false); setHistoryVersion(null) }} role="tab">{item.label}</button>)}</div>
      {error ? <ErrorMessage message={error} onRetry={() => setReload((value) => value + 1)} /> : null}
      {showForm ? (
        <form className={panelClass} onSubmit={save}>
          <FormHeader title={editorTitle(editorKind, editing, policy?.label)} onCancel={() => setShowForm(false)} />
          {editorKind === 'successor' ? <p className="mt-2 text-sm text-slate-500">You are editing a copied draft. The published source remains unchanged until this draft is published.</p> : null}
          <div className="mt-4 grid gap-4">
            <Field label="Title" error={fieldErrors.title?.[0]}><input className={inputClass} maxLength={200} onChange={(event) => setForm({ ...form, title: event.target.value })} required value={form.title} /></Field>
            <Field label="Change summary (optional)" error={fieldErrors.change_summary?.[0]}><input className={inputClass} maxLength={1000} onChange={(event) => setForm({ ...form, change_summary: event.target.value })} value={form.change_summary} /></Field>
            <Field label="Policy content" error={fieldErrors.content?.[0]}><textarea className={`${inputClass} min-h-72 py-3`} maxLength={100000} onChange={(event) => setForm({ ...form, content: event.target.value })} required value={form.content} /></Field>
            <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-4 dark:border-white/10"><input checked={form.requires_reconsent} className="mt-1 size-4 accent-[#E6007A]" onChange={(event) => setForm({ ...form, requires_reconsent: event.target.checked })} type="checkbox" /><span><span className="block text-sm font-semibold">Require user re-consent</span><span className="mt-1 block text-sm leading-5 text-slate-500">This applies only to this exact version if it is published. It does not mark any user as accepted.</span></span></label>
          </div>
          <FormActions busy={busy} onPreview={() => setPreview({ title: form.title || 'Untitled policy', body: form.content })} />
        </form>
      ) : null}
      {loading ? <div className={panelClass}><p className="text-sm text-slate-500">Loading policy versions…</p></div> : (
        <>
          <div className={panelClass}><div className="flex flex-wrap items-start justify-between gap-4"><div><h4 className="font-semibold">Current published version</h4><p className="mt-1 text-sm text-slate-500">This is the version shown by the ordinary policy endpoint.</p></div>{current ? <Status value="published" /> : null}</div>{!current ? <p className="mt-5 text-sm text-slate-500">No version has been published for this policy.</p> : <PolicySummary version={current} actions={<><button className={secondaryTextButtonClass} onClick={() => setPreview({ title: current.title, body: current.content })}><FaEye />Preview</button>{canManage ? <button className={secondaryTextButtonClass} disabled={busy} onClick={() => void editPublished(current)}><FaPen />Edit published policy — creates a new draft</button> : null}</>} />}</div>
          <div className={panelClass}><h4 className="font-semibold">Drafts</h4><p className="mt-1 text-sm text-slate-500">Saving a draft does not change user-facing policy content.</p>{drafts.length === 0 ? <p className="mt-5 text-sm text-slate-500">No drafts for this policy.</p> : <div className="mt-4 divide-y divide-slate-200 border-t border-slate-200 dark:divide-white/10 dark:border-white/10">{drafts.map((version) => <PolicySummary key={version.id} version={version} actions={canManage ? <><button className={secondaryTextButtonClass} onClick={() => openDraft(version, version.source_policy_version_id ? 'successor' : 'draft')}><FaPen />Edit draft</button><button className={primaryTextButtonClass} disabled={busy} onClick={() => void publish(version)}>Publish</button></> : null} />)}</div>}</div>
          <div className={panelClass}><h4 className="font-semibold">Version history</h4><p className="mt-1 text-sm text-slate-500">Published and superseded versions are preserved exactly.</p>{history.length === 0 ? <p className="mt-5 text-sm text-slate-500">No published history for this policy.</p> : <div className="mt-4 divide-y divide-slate-200 border-t border-slate-200 dark:divide-white/10 dark:border-white/10">{history.map((version) => <PolicySummary key={version.id} version={version} actions={<button className={secondaryTextButtonClass} onClick={() => setHistoryVersion(version)}><FaEye />View exact version</button>} />)}</div>}</div>
        </>
      )}
      {preview ? <PreviewDialog content={preview} onClose={() => setPreview(null)} /> : null}
      {historyVersion ? <PreviewDialog content={{ title: `Version ${historyVersion.version}: ${historyVersion.title}`, body: historyVersion.content }} meta={`${historyVersion.status === 'published' ? 'Current' : 'Superseded'} · Published ${formatDate(historyVersion.published_at)}`} onClose={() => setHistoryVersion(null)} /> : null}
    </section>
  )
}

function PolicySummary({ actions, version }: { actions: ReactNode; version: PolicyVersion }) { return <article className="py-4"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">Version {version.version}: {version.title}</p><Status value={version.status} />{version.requires_reconsent ? <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Re-consent required</span> : null}</div>{version.change_summary ? <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{version.change_summary}</p> : null}<p className="mt-2 text-xs text-slate-400">Created {formatDate(version.created_at)}{version.published_at ? ` · Published ${formatDate(version.published_at)}` : ''}</p></div>{actions ? <div className="flex shrink-0 flex-wrap gap-3 text-sm font-semibold">{actions}</div> : null}</div></article> }

function PreviewDialog({ content, meta, onClose }: { content: NonNullable<PreviewContent>; meta?: string; onClose: () => void }) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" onKeyDown={(event) => { if (event.key === 'Escape') onClose() }} role="presentation"><section aria-labelledby="preview-title" aria-modal="true" className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-xl border border-slate-200 bg-white p-5 text-slate-950 shadow-lg dark:border-white/10 dark:bg-[#171921] dark:text-white" role="dialog"><div className="flex items-start justify-between gap-4"><div><h4 className="text-lg font-semibold" id="preview-title">{content.title}</h4>{meta ? <p className="mt-1 text-xs text-slate-500">{meta}</p> : null}</div><button aria-label="Close preview" className="rounded-md p-2 text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#E6007A] dark:hover:bg-white/10" onClick={onClose}><FaXmark /></button></div><div className="mt-5 border-t border-slate-200 pt-5 dark:border-white/10"><p className="whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-200">{content.body || 'No content to preview.'}</p></div></section></div> }
function PrimaryButton({ children, onClick, disabled, type = 'button' }: { children: ReactNode; onClick?: () => void; disabled?: boolean; type?: 'button' | 'submit' }) { return <button className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#4C1268] px-4 text-sm font-semibold text-white hover:bg-[#3d0e54] focus:outline-none focus:ring-2 focus:ring-[#E6007A] focus:ring-offset-2 disabled:opacity-60" disabled={disabled} onClick={onClick} type={type}>{children}</button> }
function FormHeader({ onCancel, title }: { onCancel: () => void; title: string }) { return <div className="flex items-center justify-between gap-4"><h4 className="font-semibold">{title}</h4><button className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200" onClick={onCancel} type="button">Cancel</button></div> }
function FormActions({ busy, onPreview }: { busy: boolean; onPreview: () => void }) { return <div className="mt-5 flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-white/10"><button className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#E6007A] dark:border-white/15 dark:hover:bg-white/5" onClick={onPreview} type="button"><FaEye />Preview</button><button className="h-10 rounded-lg bg-[#4C1268] px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={busy}>{busy ? 'Saving…' : 'Save draft'}</button></div> }
function ErrorMessage({ message, onRetry }: { message: string; onRetry: () => void }) { return <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200" role="alert"><span>{message}</span><button className="font-semibold underline underline-offset-2" onClick={onRetry}>Retry</button></div> }
function Field({ children, error, label }: { children: ReactNode; error?: string; label: string }) { return <label className="grid gap-1.5 text-sm font-medium">{label}{children}{error ? <span className="text-xs text-rose-700 dark:text-rose-300">{error}</span> : null}</label> }
function Status({ value }: { value: string }) { return <span className="text-xs font-medium capitalize text-slate-500 dark:text-slate-400">{value}</span> }

function editorTitle(kind: 'new' | 'draft' | 'successor', editing: PolicyVersion | null, label?: string) { if (kind === 'successor' && editing) return `Edit successor draft version ${editing.version}`; if (editing) return `Edit draft version ${editing.version}`; return `New ${label ?? 'policy'} version` }
function tabClass(active: boolean) { return `whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#E6007A] ${active ? 'border-[#E6007A] text-slate-950 dark:text-white' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}` }
function formatDate(value: string | null) { return value ? new Date(value).toLocaleString() : 'Not published' }

const panelClass = 'mt-5 rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.035]'
const inputClass = 'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#E6007A] focus:ring-3 focus:ring-pink-100 dark:border-white/15 dark:bg-[#171921] dark:focus:ring-pink-500/10'
const secondaryTextButtonClass = 'inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-[#E6007A] dark:text-slate-300 dark:hover:text-white'
const primaryTextButtonClass = 'text-[#4C1268] hover:underline focus:outline-none focus:ring-2 focus:ring-[#E6007A] dark:text-purple-300'
