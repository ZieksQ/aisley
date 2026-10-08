import { money, titleCase } from './model'
import type { Voucher } from './types'

export function VoucherOverview({ voucher }: { voucher: Voucher }) {
  return (
    <section>
      <h2>Overview</h2>
      <dl>
        <dt>Status</dt>
        <dd>{titleCase(voucher.status)}</dd>
        <dt>Published version</dt>
        <dd>{voucher.version || 'Not published'}</dd>
        <dt>Committed redemptions</dt>
        <dd>{voucher.redeemed_count}</dd>
        <dt>Remaining capacity</dt>
        <dd>{voucher.remaining_capacity ?? 'Unlimited'}</dd>
        <dt>Customer savings</dt>
        <dd>{money(voucher.customer_savings)}</dd>
      </dl>
      <p className="mt-4">
        Savings include committed redemptions from cancelled Orders. They are
        not settled expenses or profit.
      </p>
    </section>
  )
}
