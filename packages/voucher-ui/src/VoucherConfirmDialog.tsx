import { Confirmation } from './Confirmation'
import { TermsView } from './TermsView'
import { benefit, funding, titleCase } from './model'
import type { Voucher, VoucherProps } from './types'

export function VoucherConfirmDialog({
  action,
  voucher,
  role,
  onConfirm,
  onCancel,
}: {
  action: string
  voucher: Voucher
  role: VoucherProps['role']
  onConfirm: () => void
  onCancel: () => void
}) {
  const draftTerms = voucher.draft?.terms
  return (
    <Confirmation
      title={`${titleCase(action)} voucher`}
      confirm={action === 'end' ? 'End permanently' : titleCase(action)}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      {action === 'publish' && draftTerms ? (
        <>
          <p className="mb-4">
            Publish {benefit(draftTerms)} with these exact terms.{' '}
            {funding(role)}{' '}
            {voucher.lifecycle === 'published'
              ? 'Existing Orders keep their original snapshots and cumulative usage remains consumed.'
              : 'Customer availability begins at the start below.'}{' '}
            {!voucher.is_active && voucher.lifecycle === 'published'
              ? 'This voucher will remain paused.'
              : ''}
          </p>
          <TermsView terms={draftTerms} />
        </>
      ) : (
        <p>
          {action === 'end'
            ? 'Permanently stop new redemptions. This cannot be resumed or republished; existing usage remains consumed.'
            : action === 'pause'
              ? 'Stop new redemptions until resumed. Terms and cumulative usage remain unchanged.'
              : action === 'resume'
                ? 'Allow new eligible redemptions within the published schedule and limits.'
                : action === 'discard'
                  ? 'Discard this working draft and keep the published terms.'
                  : 'Create an independent draft with a generated code, new identity and zero usage.'}
        </p>
      )}
    </Confirmation>
  )
}
