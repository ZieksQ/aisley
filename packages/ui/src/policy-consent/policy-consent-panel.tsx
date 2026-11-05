'use client';

import type { CSSProperties } from 'react';
import { policyTypes, type ConsentApi } from './types';
import { usePolicyConsent } from './use-policy-consent';

export type PolicyConsentPanelProps = {
  api: ConsentApi;
  historyBaseUrl?: string;
  onComplete?: () => void;
  accent?: 'purple' | 'blue';
};

function date(value: string | null) {
  return value ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: 'Asia/Manila' }).format(new Date(value)) : 'Date unavailable';
}

export function PolicyConsentPanel({ api, historyBaseUrl = '', onComplete, accent = 'purple' }: PolicyConsentPanelProps) {
  const model = usePolicyConsent(api, onComplete);
  const style = {
    '--consent-brand': `var(--brand-primary, ${accent === 'blue' ? '#2563eb' : '#4c1268'})`,
    '--consent-ink': 'var(--portal-text, #231429)',
    '--consent-muted': 'var(--portal-muted, #4b5563)',
    '--consent-surface': 'var(--portal-surface, #fff)',
    '--consent-document-surface': 'var(--portal-subtle, #f7f5f7)',
    '--consent-border': 'var(--portal-border, #d1d5db)',
    color: 'var(--consent-ink)',
  } as CSSProperties;

  return (
    <section className="mx-auto w-full max-w-4xl" style={style} aria-busy={model.loading || model.busy}>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Terms and Privacy</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--consent-muted)]">Review the Terms of Service and Privacy Policy, then confirm below.</p>
      </header>
      {model.loading && <p className="py-6 text-sm" role="status">Loading policies…</p>}
      {model.error && <p className="mb-4 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100" role="alert">{model.error}</p>}
      {model.message && <p className="mb-4 text-sm" role="status">{model.message}</p>}
      {model.status && (
        <div className="rounded-lg border border-[var(--consent-border)] bg-[var(--consent-surface)] p-4 sm:p-6">
          <div className="space-y-8">
            {policyTypes.map((type) => {
              const policy = model.status!.policies.find((item) => item.type === type);
              const document = model.documents[type];
              const label = type === 'terms_of_service' ? 'Terms of Service' : 'Privacy Policy';
              return (
                <article key={type} aria-labelledby={`consent-${type}`}>
                  <h2 className="text-lg font-semibold" id={`consent-${type}`}>{label}</h2>
                  {document ? (
                    <>
                    <p className="mt-1 text-sm text-[var(--consent-muted)]">Version {document.version} · Published {date(document.published_at)}</p>
                    {document.change_summary && <p className="mt-3 text-sm leading-6"><strong>What changed:</strong> {document.change_summary}</p>}
                    <div
                      aria-labelledby={`consent-${type}`}
                      className="mt-4 max-h-[clamp(10rem,25dvh,16rem)] overflow-y-auto overscroll-contain rounded-md border border-[var(--consent-border)] bg-[var(--consent-document-surface)] p-4 text-base leading-7 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--consent-brand)]"
                      role="region"
                      tabIndex={0}
                    >
                      <p className="whitespace-pre-wrap break-words">{document.content}</p>
                    </div>
                    </>
                  ) : (
                    <p className="mt-3 text-sm text-[var(--consent-muted)]">
                      {policy?.required
                        ? 'This required document is unavailable. Refresh before accepting.'
                        : 'No published version is available.'}
                    </p>
                  )}
                  <a
                    className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-[var(--portal-accent,var(--consent-brand))] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
                    href={`${historyBaseUrl}/policies/${type}/history`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View {label} history<span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </article>
              );
            })}
          </div>
          <form className="mt-6 pt-4" onSubmit={(event) => { event.preventDefault(); void model.accept(); }}>
            <fieldset disabled={model.loading || model.busy} className="space-y-2">
              <legend className="mb-2 text-base font-semibold">Your confirmation</legend>
              {policyTypes.map((type) => {
                const policy = model.status!.policies.find((item) => item.type === type);
                const document = model.documents[type];
                const covered = Boolean(policy?.current_version && !policy.required);
                const label = type === 'terms_of_service' ? 'Terms of Service' : 'Privacy Policy';
                return (
                  <label className="flex min-h-12 items-start gap-3 py-2 text-sm leading-6" key={type}>
                    <input
                      className="mt-1 size-4 shrink-0 accent-[var(--consent-brand)] focus-visible:outline-2 focus-visible:outline-offset-2"
                      type="checkbox"
                      checked={covered || Boolean(document && model.checked[type] === document.id)}
                      disabled={covered || !policy?.required || !document}
                      onChange={(event) => model.confirm(type, event.target.checked)}
                    />
                    <span>
                      {covered
                        ? `${label}: no further confirmation needed.`
                        : `I have read and agree to the ${label}${document ? `, version ${document.version}` : ''}.`}
                      {covered && policy?.accepted_at && (
                        <span className="block text-[var(--consent-muted)]">Accepted {date(policy.accepted_at)}.</span>
                      )}
                      {covered && !policy?.accepted_at && policy?.accepted_version && (
                        <span className="block text-[var(--consent-muted)]">Your previous acceptance covers this version.</span>
                      )}
                    </span>
                  </label>
                );
              })}
            </fieldset>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <button
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--consent-brand)] px-6 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!model.mayAccept}
                type="submit"
              >
                {model.busy ? 'Accepting…' : 'Accept'}
              </button>
              {model.status.all_required_accepted && <p className="text-sm text-[var(--consent-muted)]">Your policy consent is up to date.</p>}
            </div>
          </form>
        </div>
      )}
      {model.error && <button className="mt-4 min-h-11 rounded-lg border border-[var(--consent-border)] px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60" disabled={model.loading || model.busy || model.coolingDown} onClick={() => void model.load()} type="button">Refresh policies</button>}
    </section>
  );
}
