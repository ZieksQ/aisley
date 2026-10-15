import { money, titleCase } from './model'
import type { Voucher } from './types'

export function VoucherOverview({ voucher }: { voucher: Voucher }) {
  return (
    <section className="voucher-overview">
      <h2>Overview</h2>
      <dl>
        <div>
          <dt>Status</dt>
          <dd>{titleCase(voucher.status)}</dd>
        </div>
        <div>
          <dt>Published version</dt>
          <dd>{voucher.version || 'Not published'}</dd>
        </div>
        <div>
          <dt>Committed redemptions</dt>
          <dd>{voucher.redeemed_count}</dd>
        </div>
        <div>
          <dt>Remaining capacity</dt>
          <dd>{voucher.remaining_capacity ?? 'Unlimited'}</dd>
        </div>
        <div>
          <dt>Customer savings</dt>
          <dd>{money(voucher.customer_savings)}</dd>
        </div>
      </dl>
      <p className="mt-4">
        Savings include committed redemptions from cancelled Orders. They are
        not settled expenses or profit.
      </p>
    </section>
  )
}
