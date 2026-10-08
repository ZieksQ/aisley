import { Button } from '@aisley/ui'
import type { useMutation } from './useMutation'

export function MutationFeedback({
  mutation,
}: {
  mutation: ReturnType<typeof useMutation>
}) {
  if (mutation.busy) return <p role="status">Saving voucher changes…</p>
  if (!mutation.error) return null
  return (
    <div role="alert" className="voucher-error">
      <p>
        {mutation.pending
          ? 'The result is unconfirmed. Retry this exact request before taking another action.'
          : mutation.error.message}
      </p>
      {mutation.pending && (
        <Button
          variant="outline"
          disabled={mutation.busy}
          onClick={mutation.retry}
        >
          Retry exact request
        </Button>
      )}
      {mutation.error.status === 409 && !mutation.pending && (
        <p>
          Reload the voucher and review the latest revision before trying again.
        </p>
      )}
    </div>
  )
}
