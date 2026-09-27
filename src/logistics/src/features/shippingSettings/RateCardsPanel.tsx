import { useEffect, useState } from 'react'
import { FaPlus } from 'react-icons/fa6'
import { ActionButton, PrimaryButton, panel } from '../../components/PickupUi'
import { centimeters, kilograms, manilaDate, peso, serviceLabels } from './formatters'
import { RateCardForm } from './RateCardForm'
import type { ProductCategoryOption, RateCard, RateCardDraft } from './types'

type Props = {
  cards: RateCard[]
  categories: ProductCategoryOption[]
  publishingId: string | null
  onCreate: (draft: RateCardDraft) => Promise<void>
  onPublish: (id: string) => Promise<void>
}

function Status({ status }: { status: RateCard['status'] }) {
  const tone = status === 'published' ? 'text-emerald-700 dark:text-emerald-300' : status === 'draft' ? 'text-amber-700 dark:text-amber-300' : 'text-zinc-500'
  return <span className={`text-sm font-medium capitalize ${tone}`}>{status}</span>
}

export function RateCardsPanel({ cards, categories, onCreate, onPublish, publishingId }: Props) {
  const [creating, setCreating] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(cards[0]?.id ?? null)
  const selected = cards.find((card) => card.id === selectedId) ?? null

  useEffect(() => {
    if (!selectedId && cards[0]) setSelectedId(cards[0].id)
  }, [cards, selectedId])

  if (creating) {
    return <div><div className="mb-4"><h3 className="font-semibold">Create rate card</h3><p className="mt-1 text-sm text-zinc-500">Add one rule for every product category and service leg your organization intends to quote.</p></div><RateCardForm categories={categories} onCancel={() => setCreating(false)} onCreate={async (draft) => { await onCreate(draft); setCreating(false) }} /></div>
  }

  return <div className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">Rate cards</h3><p className="mt-1 text-sm text-zinc-500">Published versions replace the previous commercial card without changing placed-order pricing.</p></div><PrimaryButton disabled={!categories.length} onClick={() => setCreating(true)}><FaPlus aria-hidden="true" />Create rate card</PrimaryButton></div>
    {!categories.length ? <p className="border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-100">No active product categories are available, so a rate card cannot be created.</p> : null}
    <section className={`${panel} overflow-hidden`}>
      {cards.length ? <div className="overflow-x-auto" tabIndex={0} aria-label="Rate card versions"><table className="w-full min-w-[42rem] text-left text-sm"><thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-white/[0.03]"><tr><th className="px-4 py-3 font-medium sm:px-5">Version</th><th className="px-4 py-3 font-medium">Effective</th><th className="px-4 py-3 font-medium">Rules</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 text-right font-medium">Actions</th></tr></thead><tbody>{cards.map((card) => <tr className={`border-t border-zinc-200 dark:border-white/10 ${selectedId === card.id ? 'bg-purple-50/50 dark:bg-purple-400/[0.06]' : ''}`} key={card.id}><td className="px-4 py-3 font-medium sm:px-5">Version {card.version_number}</td><td className="px-4 py-3">{manilaDate(card.effective_at)}</td><td className="px-4 py-3">{card.rules.length}</td><td className="px-4 py-3"><Status status={card.status} /></td><td className="px-4 py-3"><div className="flex justify-end gap-2"><ActionButton aria-pressed={selectedId === card.id} onClick={() => setSelectedId(card.id)}>View</ActionButton>{card.status === 'draft' ? <ActionButton busy={publishingId === card.id} onClick={() => { if (window.confirm(`Publish rate card version ${card.version_number}? The current published version will be archived and placed-order prices will remain unchanged.`)) void onPublish(card.id) }}>Publish</ActionButton> : null}</div></td></tr>)}</tbody></table></div> : <p className="p-5 text-sm text-zinc-500">No rate cards have been created.</p>}
    </section>
    {selected ? <section className={`${panel} overflow-hidden`}><div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-white/10 sm:px-5"><div><h4 className="font-semibold">Version {selected.version_number} rules</h4><p className="mt-1 text-xs text-zinc-500">{selected.status === 'draft' ? 'Immutable draft' : `Published ${manilaDate(selected.published_at)}`}</p></div><Status status={selected.status} /></div>{selected.rules.length ? <ul className="divide-y divide-zinc-200 dark:divide-white/10">{selected.rules.map((rule) => <li className="p-4 sm:p-5" key={rule.id}><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium">{rule.category?.name ?? 'Archived category'}</p><p className="mt-0.5 text-sm text-zinc-500">{serviceLabels[rule.service_type]}</p></div><p className="text-sm font-semibold">{peso(rule.base_charge_cents)} base</p></div><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><div><dt className="text-xs text-zinc-500">Included weight</dt><dd className="mt-0.5">{kilograms(rule.included_weight_grams)}</dd></div><div><dt className="text-xs text-zinc-500">Additional charge</dt><dd className="mt-0.5">{peso(rule.additional_fee_cents)} / {kilograms(rule.additional_weight_grams)}</dd></div><div><dt className="text-xs text-zinc-500">Maximum weight</dt><dd className="mt-0.5">{kilograms(rule.max_weight_grams)}</dd></div><div><dt className="text-xs text-zinc-500">Maximum dimensions</dt><dd className="mt-0.5">{centimeters(rule.max_length_mm)} × {centimeters(rule.max_width_mm)} × {centimeters(rule.max_height_mm)}</dd></div></dl></li>)}</ul> : <p className="p-5 text-sm text-zinc-500">This draft has no rules and cannot be published.</p>}</section> : null}
  </div>
}
