import { useEffect, useState } from 'react'
import { VoucherEditor } from './VoucherEditor'
import { MutationFeedback } from './MutationFeedback'
import { useMutation } from './useMutation'
import { useUnsaved } from './useUnsaved'
import type { VoucherProps } from './types'

export function NewVoucher(props: VoucherProps) {
  const [accessLost, setAccessLost] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [created, setCreated] = useState<string | null>(null)
  const mutation = useMutation(
    props,
    (voucher) => setCreated(voucher.id),
    () => setAccessLost(true),
    accessLost,
  )
  useUnsaved(
    {
      dirty: created ? false : dirty,
      busy: mutation.busy,
      uncertain: Boolean(mutation.pending),
    },
    props.onGuardChange,
  )
  useEffect(() => {
    if (created) props.navigate(`/vouchers/${created}`, true)
  }, [created, props.navigate])
  if (!props.canManage || accessLost)
    return (
      <main className="vouchers">
        <h1>Voucher access unavailable</h1>
        <p role="alert">
          Voucher management permission and an active session are required.
        </p>
      </main>
    )
  if (created)
    return (
      <main className="vouchers">
        <p role="status">Draft saved. Opening voucher…</p>
      </main>
    )
  return (
    <main className="vouchers">
      <header>
        <h1>Create voucher</h1>
      </header>
      <MutationFeedback mutation={mutation} />
      <VoucherEditor
        role={props.role}
        revision={0}
        identityLocked={false}
        busy={mutation.busy}
        uncertain={Boolean(mutation.pending)}
        error={mutation.error}
        onSubmit={(body) => mutation.run('create', null, body)}
        onCancel={() => props.navigate('/vouchers', true)}
        onDirtyChange={setDirty}
      />
    </main>
  )
}
