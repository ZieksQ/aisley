import { benefit, date, money } from './model'
import type { Terms } from './types'

export function TermsView({ terms }: { terms: Terms }) {
  return (
    <dl>
      <dt>Voucher name</dt>
      <dd>{terms.name ?? terms.code}</dd>
      <dt>Code</dt>
      <dd>{terms.code}</dd>
      <dt>Benefit</dt>
      <dd>{benefit(terms)}</dd>
      <dt>Savings cap</dt>
      <dd>
        {terms.maximum_discount
          ? money(terms.maximum_discount)
          : 'No additional cap'}
      </dd>
      <dt>Minimum spend</dt>
      <dd>{money(terms.minimum_spend)}</dd>
      <dt>Starts (Asia/Manila)</dt>
      <dd>{date(terms.starts_at)}</dd>
      <dt>Ends (Asia/Manila)</dt>
      <dd>{date(terms.ends_at)}</dd>
      <dt>Total limit</dt>
      <dd>{terms.global_limit ?? 'Unlimited'}</dd>
      <dt>Per Customer</dt>
      <dd>{terms.per_customer_limit}</dd>
      <dt>Payment / currency</dt>
      <dd>COD / PHP</dd>
      <dt>Stacking</dt>
      <dd>One discount and one shipping voucher per Shop order.</dd>
      <dt>Eligibility</dt>
      <dd>
        {terms.eligibility_scope === 'legacy_targeted' ||
        Object.values(terms.eligibility_rules ?? {}).some(
          (value) => value?.length,
        )
          ? 'Legacy targeted eligibility; authoring unavailable'
          : 'All eligible items'}
      </dd>
      <dt>Terms</dt>
      <dd>{terms.terms_summary}</dd>
    </dl>
  )
}
