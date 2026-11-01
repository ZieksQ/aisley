import { FaFileLines } from 'react-icons/fa6'
import type { CourierApplicationDocument } from '../../types/courierApplications'
import { StatusBadge } from './ApplicationStatus'

export type EvidenceState = { status: 'idle' | 'loading' | 'success' | 'forbidden' | 'missing' | 'unavailable'; url?: string; error?: string }

function documentSize(bytes: number | null): string {
  if (!bytes) return 'Size unavailable'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function evidenceMessage(state: EvidenceState): string {
  if (state.status === 'forbidden') return 'Evidence is not available to this Logistics account.'
  if (state.status === 'missing') return 'The applicant did not provide this document.'
  if (state.status === 'unavailable') return 'Evidence could not be reached right now. Try again later.'
  return state.error ?? 'Evidence is unavailable.'
}

export function EvidenceCard({ document, state, onPreview }: { document: CourierApplicationDocument; state: EvidenceState; onPreview: () => void }) {
  const isImage = document.mime_type?.startsWith('image/') ?? false
  return <li
    className="border-t border-[var(--portal-border)] py-4 first:border-t-0 first:pt-0 last:pb-0 dark:border-[var(--portal-border)]">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className="mt-0.5 grid size-9 shrink-0 place-items-center bg-zinc-100 text-[var(--portal-muted)] dark:bg-white/10 dark:text-zinc-300"><FaFileLines aria-hidden="true" /></span>
        <div className="min-w-0">
          <p className="font-medium">{document.label}</p>
          <p className="mt-1 truncate text-xs text-[var(--portal-muted)]">{document.original_name ?? 'Filename unavailable'} · {documentSize(document.size_bytes)}</p>
        </div>
      </div>
      <StatusBadge status={document.status} />
    </div>
    {!document.present ? <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">Missing evidence</p> : state.status === 'success' && state.url ? <div className="mt-3 space-y-3">
      <div
        className="overflow-hidden border border-[var(--portal-border)] bg-[var(--portal-subtle)] dark:border-[var(--portal-border)] dark:bg-white/[0.03]">
        {isImage ? <img alt={`${document.label} preview`} className="max-h-72 w-full object-contain" src={state.url} /> : <a
          className={`inline-flex min-h-11 items-center font-medium text-[var(--portal-accent)] underline-offset-4 hover:underline block p-4 text-sm`}
          href={state.url}
          rel="noreferrer"
          target="_blank">Open document preview</a>}
      </div>
      <div className="flex gap-3 text-sm">
        <a
          className="inline-flex min-h-11 items-center font-medium text-[var(--portal-accent)] underline-offset-4 hover:underline"
          download={document.original_name ?? 'courier-document'}
          href={state.url}>Download</a>
        <button
          className="inline-flex min-h-11 items-center font-medium text-[var(--portal-accent)] underline-offset-4 hover:underline"
          onClick={onPreview}
          type="button">Reload preview</button>
      </div>
    </div> : state.status === 'loading' ? <p className="mt-3 text-sm text-[var(--portal-muted)]" role="status">Loading private evidence…</p> : state.status === 'forbidden' || state.status === 'unavailable' ? <div className="mt-3 flex flex-wrap items-center gap-3">
      <p className="text-sm text-[var(--portal-muted)]">{evidenceMessage(state)}</p>
      {state.status === 'unavailable' ? <button
        className={`inline-flex min-h-11 items-center font-medium text-[var(--portal-accent)] underline-offset-4 hover:underline text-sm`}
        onClick={onPreview}
        type="button">Try again</button> : null}
    </div> : <button
      className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md border border-zinc-300 px-3 text-sm font-medium hover:bg-zinc-100 dark:border-slate-500 dark:hover:bg-white/10"
      onClick={onPreview}
      type="button">Preview evidence</button>}
  </li>
}
