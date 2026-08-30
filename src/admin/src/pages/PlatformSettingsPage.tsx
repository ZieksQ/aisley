import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { FaBullhorn, FaFileLines, FaPen, FaPlus } from 'react-icons/fa6'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ApiError, apiRequest } from '../lib/api'
import type { Announcement, Paginated, Policy, PolicyType, PolicyVersion } from '../types/platformSettings'

export function PlatformSettingsPage() {
  const { admin } = useAuth()
  const [params, setParams] = useSearchParams()
  const section = params.get('section') === 'policies' ? 'policies' : 'announcements'
  const canManage = admin?.permissions.includes('platform-settings.manage') ?? false

  useEffect(() => { document.title = 'Platform settings | Aisley Admin' }, [])

  return <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
    <div className="border-b border-slate-200 pb-5 dark:border-white/10"><h2 className="text-2xl font-semibold tracking-tight">Platform settings</h2><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Publish platform announcements and maintain versioned policy content.</p></div>
    <div className="mt-6 flex gap-5 border-b border-slate-200 dark:border-white/10" role="tablist" aria-label="Platform settings sections"><button aria-selected={section === 'announcements'} className={`border-b-2 px-1 pb-3 text-sm font-semibold ${section === 'announcements' ? 'border-[#E6007A] text-slate-950 dark:text-white' : 'border-transparent text-slate-500'}`} onClick={() => setParams({ section: 'announcements' })} role="tab"><span className="inline-flex items-center gap-2"><FaBullhorn />Announcements</span></button><button aria-selected={section === 'policies'} className={`border-b-2 px-1 pb-3 text-sm font-semibold ${section === 'policies' ? 'border-[#E6007A] text-slate-950 dark:text-white' : 'border-transparent text-slate-500'}`} onClick={() => setParams({ section: 'policies' })} role="tab"><span className="inline-flex items-center gap-2"><FaFileLines />Policies</span></button></div>
    {section === 'announcements' ? <Announcements canManage={canManage} /> : <Policies canManage={canManage} />}
  </div>
}

function Announcements({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<Announcement[]>([])
  const [status, setStatus] = useState('')
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [form, setForm] = useState({ title: '', body: '', expires_at: '' })
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [reload, setReload] = useState(0)

  useEffect(() => {
    setLoading(true); setError('')
    const query = status ? `?status=${status}` : ''
    apiRequest<Paginated<Announcement>>(`/api/v1/admin/platform-settings/announcements${query}`).then((response) => setItems(response.data)).catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load announcements.')).finally(() => setLoading(false))
  }, [reload, status])

  function openCreate() { setEditing(null); setForm({ title: '', body: '', expires_at: '' }); setFieldErrors({}); setShowForm(true) }
  function openEdit(item: Announcement) { setEditing(item); setForm({ title: item.title, body: item.body, expires_at: item.expires_at ? item.expires_at.slice(0, 16) : '' }); setFieldErrors({}); setShowForm(true) }

  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setFieldErrors({})
    try {
      const payload = { ...form, expires_at: form.expires_at || null, ...(editing ? { revision: editing.revision } : {}) }
      await apiRequest(editing ? `/api/v1/admin/platform-settings/announcements/${editing.id}` : '/api/v1/admin/platform-settings/announcements', { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(payload) })
      setShowForm(false); setEditing(null); setReload((value) => value + 1)
    } catch (caught) {
      if (caught instanceof ApiError) { setFieldErrors(caught.errors); setError(caught.status === 409 ? 'This announcement changed. Refresh and review it before trying again.' : caught.message) }
      else setError('Unable to save the announcement.')
    } finally { setBusy(false) }
  }

  async function transition(item: Announcement, action: 'publish' | 'archive') {
    const question = action === 'publish' ? `Publish “${item.title}” to the platform feed?` : `Archive “${item.title}” and remove it from the platform feed?`
    if (!window.confirm(question)) return
    setBusy(true); setError('')
    try { await apiRequest(`/api/v1/admin/platform-settings/announcements/${item.id}/${action}`, { method: 'POST', body: JSON.stringify({ revision: item.revision }) }); setReload((value) => value + 1) }
    catch (caught) { setError(caught instanceof ApiError && caught.status === 409 ? 'This announcement changed. The list has been refreshed.' : caught instanceof Error ? caught.message : `Unable to ${action} announcement.`); setReload((value) => value + 1) }
    finally { setBusy(false) }
  }

  return <section className="mt-6" aria-labelledby="announcements-heading"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold" id="announcements-heading">Announcements</h3><p className="mt-1 text-sm text-slate-500">Only published, unexpired announcements appear in user-facing feeds.</p></div>{canManage ? <button className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#4C1268] px-4 text-sm font-semibold text-white" onClick={openCreate}><FaPlus />New announcement</button> : null}</div>
    {error ? <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200" role="alert">{error}</p> : null}
    {showForm ? <form className="mt-5 rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.035]" onSubmit={save}><div className="flex items-center justify-between"><h4 className="font-semibold">{editing ? 'Edit draft' : 'New announcement draft'}</h4><button className="text-sm text-slate-500" onClick={() => setShowForm(false)} type="button">Cancel</button></div><div className="mt-4 grid gap-4"><Field label="Title" error={fieldErrors.title?.[0]}><input className={inputClass} maxLength={160} onChange={(event) => setForm({ ...form, title: event.target.value })} required value={form.title} /></Field><Field label="Content" error={fieldErrors.body?.[0]}><textarea className={`${inputClass} min-h-36 py-3`} maxLength={20000} onChange={(event) => setForm({ ...form, body: event.target.value })} required value={form.body} /></Field><Field label="Expiration (optional)" error={fieldErrors.expires_at?.[0]}><input className={inputClass} onChange={(event) => setForm({ ...form, expires_at: event.target.value })} type="datetime-local" value={form.expires_at} /></Field></div><div className="mt-5 flex justify-end border-t border-slate-200 pt-4 dark:border-white/10"><button className="h-10 rounded-lg bg-[#4C1268] px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={busy}>{busy ? 'Saving…' : 'Save draft'}</button></div></form> : null}
    <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.035]"><div className="border-b border-slate-200 p-4 dark:border-white/10"><select aria-label="Filter announcements" className={`${inputClass} max-w-48`} onChange={(event) => setStatus(event.target.value)} value={status}><option value="">All statuses</option><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></div>{loading ? <p className="p-5 text-sm text-slate-500">Loading announcements…</p> : items.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No announcements in this view.</p> : <div className="divide-y divide-slate-200 dark:divide-white/10">{items.map((item) => <article className="p-5" key={item.id}><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold">{item.title}</h4><Status value={item.status} /></div><p className="mt-2 line-clamp-2 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{item.body}</p><p className="mt-2 text-xs text-slate-400">Updated {new Date(item.updated_at).toLocaleString()}{item.expires_at ? ` · Expires ${new Date(item.expires_at).toLocaleString()}` : ''}</p></div>{canManage ? <div className="flex shrink-0 gap-3 text-sm font-semibold">{item.status === 'draft' ? <><button className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300" onClick={() => openEdit(item)}><FaPen />Edit</button><button className="text-[#4C1268] dark:text-purple-300" disabled={busy} onClick={() => void transition(item, 'publish')}>Publish</button></> : item.status === 'published' ? <button className="text-rose-700 dark:text-rose-300" disabled={busy} onClick={() => void transition(item, 'archive')}>Archive</button> : null}</div> : null}</div></article>)}</div>}</div>
  </section>
}

function Policies({ canManage }: { canManage: boolean }) {
  const [policies, setPolicies] = useState<Policy[]>([])
  const [selectedType, setSelectedType] = useState<PolicyType>('terms_of_service')
  const [editing, setEditing] = useState<PolicyVersion | null>(null)
  const [form, setForm] = useState({ title: '', content: '', requires_reconsent: false })
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [reload, setReload] = useState(0)

  useEffect(() => { setLoading(true); setError(''); apiRequest<{ data: Policy[] }>('/api/v1/admin/platform-settings/policies').then((response) => setPolicies(response.data)).catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load policies.')).finally(() => setLoading(false)) }, [reload])
  const policy = policies.find((item) => item.type === selectedType)

  function openCreate() { setEditing(null); setForm({ title: policy?.label ?? '', content: '', requires_reconsent: false }); setFieldErrors({}); setShowForm(true) }
  function openEdit(version: PolicyVersion) { setEditing(version); setForm({ title: version.title, content: version.content, requires_reconsent: version.requires_reconsent }); setFieldErrors({}); setShowForm(true) }
  async function save(event: FormEvent) { event.preventDefault(); setBusy(true); setError(''); setFieldErrors({}); try { await apiRequest(editing ? `/api/v1/admin/platform-settings/policy-versions/${editing.id}` : `/api/v1/admin/platform-settings/policies/${selectedType}/versions`, { method: editing ? 'PATCH' : 'POST', body: JSON.stringify({ ...form, ...(editing ? { revision: editing.revision } : {}) }) }); setShowForm(false); setEditing(null); setReload((value) => value + 1) } catch (caught) { if (caught instanceof ApiError) { setFieldErrors(caught.errors); setError(caught.status === 409 ? 'This policy draft changed. Refresh and review it before trying again.' : caught.message) } else setError('Unable to save policy draft.') } finally { setBusy(false) } }
  async function publish(version: PolicyVersion) { const warning = version.requires_reconsent ? ' This version is marked as requiring user re-consent.' : ''; if (!window.confirm(`Publish version ${version.version}? The current version will be preserved as superseded.${warning}`)) return; setBusy(true); setError(''); try { await apiRequest(`/api/v1/admin/platform-settings/policy-versions/${version.id}/publish`, { method: 'POST', body: JSON.stringify({ revision: version.revision }) }); setReload((value) => value + 1) } catch (caught) { setError(caught instanceof ApiError && caught.status === 409 ? 'This policy changed. The history has been refreshed.' : caught instanceof Error ? caught.message : 'Unable to publish policy.'); setReload((value) => value + 1) } finally { setBusy(false) } }

  return <section className="mt-6" aria-labelledby="policies-heading"><div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="font-semibold" id="policies-heading">Policies</h3><p className="mt-1 text-sm text-slate-500">Publishing creates immutable history and supersedes the previous current version.</p></div>{canManage ? <button className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#4C1268] px-4 text-sm font-semibold text-white" onClick={openCreate}><FaPlus />New version</button> : null}</div>
    <div className="mt-5 flex gap-5 overflow-x-auto border-b border-slate-200 dark:border-white/10">{policies.map((item) => <button className={`whitespace-nowrap border-b-2 pb-3 text-sm font-semibold ${selectedType === item.type ? 'border-[#E6007A] text-slate-950 dark:text-white' : 'border-transparent text-slate-500'}`} key={item.type} onClick={() => { setSelectedType(item.type); setShowForm(false) }}>{item.label}</button>)}</div>
    {error ? <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200" role="alert">{error}</p> : null}
    {showForm ? <form className="mt-5 rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.035]" onSubmit={save}><div className="flex justify-between gap-3"><h4 className="font-semibold">{editing ? `Edit version ${editing.version} draft` : `New ${policy?.label ?? 'policy'} version`}</h4><button className="text-sm text-slate-500" onClick={() => setShowForm(false)} type="button">Cancel</button></div><div className="mt-4 grid gap-4"><Field label="Title" error={fieldErrors.title?.[0]}><input className={inputClass} maxLength={200} onChange={(event) => setForm({ ...form, title: event.target.value })} required value={form.title} /></Field><Field label="Policy content" error={fieldErrors.content?.[0]}><textarea className={`${inputClass} min-h-72 py-3`} maxLength={100000} onChange={(event) => setForm({ ...form, content: event.target.value })} required value={form.content} /></Field><label className="flex items-start gap-3 rounded-lg border border-slate-200 p-4 dark:border-white/10"><input checked={form.requires_reconsent} className="mt-1 size-4 accent-[#E6007A]" onChange={(event) => setForm({ ...form, requires_reconsent: event.target.checked })} type="checkbox" /><span><span className="block text-sm font-semibold">Require user re-consent</span><span className="mt-1 block text-sm leading-5 text-slate-500">Marks this exact published version as requiring consent. It does not automatically accept or update any user.</span></span></label></div><div className="mt-5 flex justify-end border-t border-slate-200 pt-4 dark:border-white/10"><button className="h-10 rounded-lg bg-[#4C1268] px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={busy}>{busy ? 'Saving…' : 'Save draft'}</button></div></form> : null}
    <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.035]">{loading ? <p className="p-5 text-sm text-slate-500">Loading policy history…</p> : !policy?.versions.length ? <p className="p-8 text-center text-sm text-slate-500">No versions have been created for this policy.</p> : <div className="divide-y divide-slate-200 dark:divide-white/10">{policy.versions.map((version) => <article className="p-5" key={version.id}><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold">Version {version.version}: {version.title}</h4><Status value={version.status} />{version.requires_reconsent ? <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Re-consent required</span> : null}</div><p className="mt-2 line-clamp-3 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{version.content}</p><p className="mt-2 text-xs text-slate-400">Created {new Date(version.created_at).toLocaleString()}{version.published_at ? ` · Published ${new Date(version.published_at).toLocaleString()}` : ''}</p></div>{canManage && version.status === 'draft' ? <div className="flex shrink-0 gap-3 text-sm font-semibold"><button className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300" onClick={() => openEdit(version)}><FaPen />Edit</button><button className="text-[#4C1268] dark:text-purple-300" disabled={busy} onClick={() => void publish(version)}>Publish</button></div> : null}</div></article>)}</div>}</div>
  </section>
}

const inputClass = 'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#E6007A] focus:ring-3 focus:ring-pink-100 dark:border-white/15 dark:bg-[#171921] dark:focus:ring-pink-500/10'
function Field({ children, error, label }: { children: React.ReactNode; error?: string; label: string }) { return <label className="text-sm font-medium">{label}{children}{error ? <span className="mt-1 block text-xs text-rose-700 dark:text-rose-300">{error}</span> : null}</label> }
function Status({ value }: { value: string }) { return <span className="text-xs font-medium capitalize text-slate-500 dark:text-slate-400">{value}</span> }
