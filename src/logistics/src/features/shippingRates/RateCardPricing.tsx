import { PortalState, PortalTable } from '@aisley/ui/portal'
import { centimeters, kilograms, peso, serviceLabels } from './formatters'
import type { RateCard } from './types'

export function RateCardPricing({ card }: { card: RateCard }) {
  return <div className="space-y-6">
    <section className="portal-panel">
      <h3 className="text-lg font-semibold">Service base fees</h3>
      <p className="portal-page-description">Charged once per service leg, including each linehaul hop.</p>
      {card.services.length ? <dl className="mt-5 grid gap-5 sm:grid-cols-3">
        {card.services.map((service) => <div className="border-l-2 border-[var(--brand-primary)] pl-4" key={service.id}>
          <dt className="portal-secondary text-sm">{serviceLabels[service.service_type]}</dt>
          <dd className="mt-2 text-2xl font-semibold tracking-tight">{peso(service.base_fee_cents)}</dd>
        </div>)}
      </dl> : <p className="portal-secondary mt-4 text-sm">No services offered on this version.</p>}
    </section>
    <section className="space-y-4" aria-labelledby="rate-rules-title">
      <div>
        <h3 className="text-lg font-semibold" id="rate-rules-title">Weight extras and parcel limits</h3>
        <p className="portal-page-description">Extras apply once to the combined parcel weight for its main Shop Category and service leg. Dimensions are eligibility limits.</p>
      </div>
      {card.rules.length ? <PortalTable label="Version weight extras and parcel limits">
        <thead>
          <tr>
            <th scope="col">
              Category / service
            </th>
            <th scope="col">
              Included weight
            </th>
            <th scope="col">
              Extra per step
            </th>
            <th scope="col">
              Maximum weight
            </th>
            <th scope="col">
              Maximum L × W × H
            </th>
          </tr>
        </thead>
        <tbody>
          {card.rules.map((rule) => <tr key={rule.id}>
            <td className="portal-table-name">
              <span className="font-medium">{rule.shop_category_id ? rule.shop_category?.name ?? 'Archived Shop Category' : rule.category?.name ?? 'Archived Product Category'}</span>
              <span className="portal-table-meta">{serviceLabels[rule.service_type]}</span>
              {!rule.shop_category_id ? <span className="portal-tag portal-tag-warning mt-1">Legacy Product Category</span> : null}
            </td>
            <td className="whitespace-nowrap">
              {kilograms(rule.included_weight_grams)}
            </td>
            <td className="whitespace-nowrap">
              <span className="font-medium">{peso(rule.additional_fee_cents)}</span>
              <span className="portal-table-meta">per {kilograms(rule.additional_weight_grams)}</span>
            </td>
            <td className="whitespace-nowrap">
              {kilograms(rule.max_weight_grams)}
            </td>
            <td className="whitespace-nowrap">
              {centimeters(rule.max_length_mm)}
              ×
              {centimeters(rule.max_width_mm)}
              ×
              {centimeters(rule.max_height_mm)}
            </td>
          </tr>)}
        </tbody>
      </PortalTable> : <PortalState
        title="No category rules"
        description="This version has no category rules and cannot be published." />}
      {card.rules.some((rule) => !rule.shop_category_id) ? <p className="portal-feedback">Legacy Product Category rules remain readable for history. They do not provide main Shop Category coverage for new quotes.</p> : null}
    </section>
  </div>
}
