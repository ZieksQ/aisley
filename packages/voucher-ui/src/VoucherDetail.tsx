import { VoucherOverview } from './VoucherOverview'
import { DraftDifferences } from './DraftDifferences'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@aisley/ui'
import { denied } from './model'
import { VoucherConfirmDialog } from './VoucherConfirmDialog'
import { MutationFeedback } from './MutationFeedback'
import { TermsView } from './TermsView'
import { VoucherEditor } from './VoucherEditor'
import { VoucherHistory } from './VoucherHistory'
import { useMutation } from './useMutation'
import { useUnsaved } from './useUnsaved'
import type { Failure, Voucher, VoucherProps } from './types'

export function VoucherDetail({ id, ...props }: VoucherProps & { id: string }) {
  const [voucher, setVoucher] = useState<Voucher | null>(null)
  const [error, setError] = useState<Failure | null>(null)
  const [loading, setLoading] = useState(true)
  const [accessLost, setAccessLost] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [reload, setReload] = useState(0)
  const loseAccess = useCallback(() => {
    setAccessLost(true)
    setVoucher(null)
    setEditing(false)
    setConfirm(null)
    setNotice('')
  }, [])
  const mutation = useMutation(
    props,
    (data, action) => {
      if (action === 'duplicate') props.navigate(`/vouchers/${data.id}`, true)
      else {
        setVoucher(data)
        setEditing(false)
        setNotice(
          action === 'save'
            ? 'Draft saved. Published terms remain in effect until publication.'
            : `Voucher ${action === 'publish' ? 'published' : action === 'end' ? 'ended permanently' : action === 'discard' ? 'draft discarded' : action === 'pause' ? 'paused' : 'resumed'}.`,
        )
      }
    },
    loseAccess,
    accessLost,
  )
  useUnsaved(
    {
      dirty: accessLost ? false : dirty,
      busy: mutation.busy,
      uncertain: Boolean(mutation.pending),
    },
    props.onGuardChange,
  )
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    void props
      .request<{ data: Voucher }>(`${props.prefix}/${id}`, {
        signal: controller.signal,
      })
      .then((data) => {
        if (!controller.signal.aborted) {
          setVoucher(data.data)
          setAccessLost(false)
        }
      })
      .catch((cause: Failure) => {
        if (!controller.signal.aborted) {
          if (denied(cause)) loseAccess()
          else setError(cause)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [props.request, props.prefix, id, reload, loseAccess])
  if (accessLost)
    return (
      <main className="vouchers">
        <h1>Voucher access unavailable</h1>
        <p role="alert">
          Your session or permissions changed. Sign in or complete required
          policy consent to continue.
        </p>
      </main>
    )
  if (loading && !voucher)
    return (
      <main className="vouchers">
        <p role="status">Loading voucher…</p>
      </main>
    )
  if (error || !voucher)
    return (
      <main className="vouchers">
        <p role="alert">{error?.message ?? 'Voucher unavailable.'}</p>
        <Button
          variant="outline"
          onClick={() => setReload((value) => value + 1)}
        >
          Retry loading
        </Button>
      </main>
    )
  const disabled = mutation.busy || Boolean(mutation.pending)
  const canEdit =
    props.canManage &&
    voucher.authoring_supported &&
    voucher.lifecycle !== 'ended'
  const draftTerms = voucher.draft?.terms
  return (
    <main className="vouchers">
      <header>
        <h1>{editing ? 'Edit voucher draft' : voucher.code}</h1>
        {!editing && (
          <Button
            variant="outline"
            disabled={disabled}
            onClick={() => props.navigate('/vouchers')}
          >
            All vouchers
          </Button>
        )}
      </header>
      {notice && (
        <div className="voucher-notice" role="status">
          {notice}
          <Button
            variant="ghost"
            aria-label="Dismiss message"
            onClick={() => setNotice('')}
          >
            ×
          </Button>
        </div>
      )}
      <MutationFeedback mutation={mutation} />
      {mutation.error?.status === 409 && !mutation.pending && (
        <Button
          variant="outline"
          disabled={loading}
          onClick={() => setReload((value) => value + 1)}
        >
          Reload latest revision
        </Button>
      )}
      {editing ? (
        <VoucherEditor
          initial={draftTerms ?? voucher.terms}
          role={props.role}
          revision={voucher.revision}
          identityLocked={voucher.lifecycle !== 'draft'}
          busy={mutation.busy}
          uncertain={Boolean(mutation.pending)}
          error={mutation.error}
          onSubmit={(body) => mutation.run('save', voucher.id, body)}
          onCancel={() => setEditing(false)}
          onDirtyChange={setDirty}
        />
      ) : (
        <>
          <VoucherOverview voucher={voucher} />
          {props.canManage && (
            <div className="voucher-actions">
              {canEdit && (
                <Button disabled={disabled} onClick={() => setEditing(true)}>
                  {draftTerms ? 'Edit draft' : 'Create revision'}
                </Button>
              )}
              {canEdit && draftTerms && (
                <Button
                  disabled={disabled}
                  onClick={() => setConfirm('publish')}
                >
                  Publish draft
                </Button>
              )}
              {voucher.authoring_supported && (
                <Button
                  variant="outline"
                  disabled={disabled}
                  onClick={() => setConfirm('duplicate')}
                >
                  Duplicate
                </Button>
              )}
              {voucher.lifecycle === 'published' && (
                <Button
                  variant="outline"
                  disabled={disabled}
                  onClick={() =>
                    setConfirm(voucher.is_active ? 'pause' : 'resume')
                  }
                >
                  {voucher.is_active ? 'Pause' : 'Resume'}
                </Button>
              )}
              {voucher.lifecycle !== 'ended' && (
                <Button
                  variant="outline"
                  disabled={disabled}
                  onClick={() => setConfirm('end')}
                >
                  End permanently
                </Button>
              )}
              {voucher.lifecycle === 'published' && draftTerms && (
                <Button
                  variant="outline"
                  disabled={disabled}
                  onClick={() => setConfirm('discard')}
                >
                  Discard draft
                </Button>
              )}
            </div>
          )}
          {!voucher.authoring_supported && (
            <p className="voucher-notice">
              These legacy terms are readable. Revision and duplication are
              unavailable in v1 authoring.
            </p>
          )}
          <section>
            <h2>
              {voucher.lifecycle === 'draft'
                ? 'Draft terms'
                : 'Published terms'}
            </h2>
            <TermsView terms={voucher.terms} />
          </section>
          {draftTerms && voucher.lifecycle !== 'draft' && (
            <DraftDifferences published={voucher.terms} draft={draftTerms} />
          )}
          <VoucherHistory
            {...props}
            id={id}
            revision={voucher.revision}
            onDenied={loseAccess}
          />
        </>
      )}
      {confirm && (
        <VoucherConfirmDialog
          action={confirm}
          voucher={voucher}
          role={props.role}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const action = confirm
            setConfirm(null)
            mutation.run(action, voucher.id, { revision: voucher.revision })
          }}
        />
      )}
    </main>
  )
}
