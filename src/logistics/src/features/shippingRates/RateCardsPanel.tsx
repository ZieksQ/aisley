import { useEffect, useState } from 'react'
import { FaPlus } from 'react-icons/fa6'
import { ActionButton, PrimaryButton, panel } from '../../components/PickupUi'
import { centimeters, kilograms, manilaDate, peso, serviceLabels } from './formatters'
import { RateCardForm } from './RateCardForm'
import type { RateCard, RateCardDraft, ShopCategoryOption } from './types'

type Props = {
  cards: RateCard[]
  shopCategories: ShopCategoryOption[]
  publishingId: string | null
  onCreate: (draft: RateCardDraft) => Promise<void>
  onPublish: (id: string) => Promise<void>
}

function Status({ status }: { status: RateCard['status'] }) {
  const tone = status === 'published' ? 'text-emerald-700 dark:text-emerald-300' : status === 'draft' ? 'text-amber-700 dark:text-amber-300' : 'text-zinc-500'
  return <span className={'text-sm font-medium capitalize ' + tone}>{status}</span>
}

function ruleName(rule: RateCard['rules'][number]): string {
  if (rule.shop_category_id) return rule.shop_category?.name ?? 'Archived Shop Category'
  if (rule.category_id) return rule.category?.name ?? 'Archived Product Category'
  return 'Category unavailable'
}

export function RateCardsPanel({ cards, onCreate, onPublish, publishingId, shopCategories }: Props) {
  const [creating, setCreating] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(cards[0]?.id ?? null)
  const selected = cards.find((card) => card.id === selectedId) ?? null

  useEffect(() => {
    if (!selectedId && cards[0]) setSelectedId(cards[0].id)
  }, [cards, selectedId])

  if (creating) {
    return <div>
      <div className="mb-4">
        <h3 className="font-semibold">Create rate card</h3>
        <p className="mt-1 text-sm text-zinc-500">Set one service base and a main Shop Category extra for every offered service.</p>
      </div>
      <RateCardForm shopCategories={shopCategories} onCancel={() => setCreating(false)} onCreate={async (draft) => { await onCreate(draft); setCreating(false) }} />
    </div>
  }

  return <div className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="font-semibold">Rate cards</h3>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-500">A service base is charged once per route leg, including each linehaul hop. Main Shop Category weight extras use all item weight in a parcel and are charged once for that category on the service leg.</p>
      </div>
      <PrimaryButton disabled={!shopCategories.length} onClick={() => setCreating(true)}><FaPlus aria-hidden="true" />Create rate card</PrimaryButton>
    </div>
    {!shopCategories.length ? <p className="border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-100">No active Shop Categories are available, so a rate card cannot be created.</p> : null}
    <section className={panel + ' overflow-hidden'}>
      {cards.length ? <div aria-label="Rate card versions" className="overflow-x-auto" tabIndex={0}>
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-white/[0.03]">
            <tr><th className="px-4 py-3 font-medium sm:px-5">Version</th><th className="px-4 py-3 font-medium">Effective</th><th className="px-4 py-3 font-medium">Services</th><th className="px-4 py-3 font-medium">Main category rules</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 text-right font-medium">Actions</th></tr>
          </thead>
          <tbody>
            {cards.map((card) => <tr className={'border-t border-zinc-200 dark:border-white/10 ' + (selectedId === card.id ? 'bg-purple-50/50 dark:bg-purple-400/[0.06]' : '')} key={card.id}>
              <td className="px-4 py-3 font-medium sm:px-5">Version {card.version_number}</td>
              <td className="px-4 py-3">{manilaDate(card.effective_at)}</td>
              <td className="px-4 py-3">{card.services.length}</td>
              <td className="px-4 py-3">{card.rules.filter((rule) => rule.shop_category_id).length}</td>
              <td className="px-4 py-3"><Status status={card.status} /></td>
              <td className="px-4 py-3"><div className="flex justify-end gap-2">
                <ActionButton aria-pressed={selectedId === card.id} onClick={() => setSelectedId(card.id)} type="button">View</ActionButton>
                {card.status === 'draft' ? <ActionButton busy={publishingId === card.id} onClick={() => { if (window.confirm('Publish rate card version ' + card.version_number + '? The current published version will be archived and placed-order prices will remain unchanged.')) void onPublish(card.id) }} type="button">Publish</ActionButton> : null}
              </div></td>
            </tr>)}
          </tbody>
        </table>
      </div> : <p className="p-5 text-sm text-zinc-500">No rate cards have been created.</p>}
    </section>
    {selected ? <section className={panel + ' overflow-hidden'}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-white/10 sm:px-5">
        <div>
          <h4 className="font-semibold">Version {selected.version_number} pricing</h4>
          <p className="mt-1 text-xs text-zinc-500">{selected.status === 'draft' ? 'Immutable draft' : 'Published ' + manilaDate(selected.published_at)}</p>
        </div>
        <Status status={selected.status} />
      </div>
      <div className="border-b border-zinc-200 p-4 dark:border-white/10 sm:p-5">
        <h5 className="font-semibold">Service bases</h5>
        <p className="mt-1 text-sm text-zinc-500">Each base applies once to its service leg. Linehaul applies once per hop.</p>
        {selected.services.length ? <dl className="mt-3 grid gap-3 sm:grid-cols-3">
          {selected.services.map((service) => <div className="border-l-2 border-[#4C1268] pl-3 dark:border-purple-300" key={service.id}>
            <dt className="text-sm text-zinc-500">{serviceLabels[service.service_type]}</dt>
            <dd className="mt-0.5 font-semibold">{peso(service.base_fee_cents)}</dd>
          </div>)}
        </dl> : <p className="mt-3 text-sm text-zinc-500">No services are offered on this card.</p>}
      </div>
      <div className="p-4 sm:p-5">
        <h5 className="font-semibold">Main Shop Category weight and size extras</h5>
        {selected.rules.length ? <ul className="mt-3 divide-y divide-zinc-200 dark:divide-white/10">
          {selected.rules.map((rule) => <li className="py-4 first:pt-0 last:pb-0" key={rule.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="font-medium">{ruleName(rule)}</p><p className="mt-0.5 text-sm text-zinc-500">{rule.shop_category_id ? 'Main Shop Category' : 'Legacy Product Category'} · {serviceLabels[rule.service_type]}</p></div>
              <p className="text-sm font-semibold">{peso(rule.additional_fee_cents)} per {kilograms(rule.additional_weight_grams)}</p>
            </div>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div><dt className="text-xs text-zinc-500">Included weight</dt><dd className="mt-0.5">{kilograms(rule.included_weight_grams)}</dd></div>
              <div><dt className="text-xs text-zinc-500">Maximum weight</dt><dd className="mt-0.5">{kilograms(rule.max_weight_grams)}</dd></div>
              <div><dt className="text-xs text-zinc-500">Maximum dimensions</dt><dd className="mt-0.5">{centimeters(rule.max_length_mm)} × {centimeters(rule.max_width_mm)} × {centimeters(rule.max_height_mm)}</dd></div>
            </dl>
          </li>)}
        </ul> : <p className="mt-3 text-sm text-zinc-500">This draft has no main Shop Category rules and cannot be published.</p>}
      </div>
    </section> : null}
  </div>
}
