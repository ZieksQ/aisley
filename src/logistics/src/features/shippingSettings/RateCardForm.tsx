import { useState } from 'react'
import { FaPlus, FaTrash } from 'react-icons/fa6'
import { ActionButton, PrimaryButton, field, panel } from '../../components/PickupUi'
import { serviceLabels, serviceTypes } from './formatters'
import type { ProductCategoryOption, RateCardDraft, RuleDraft, ServiceType } from './types'

type Props = {
  categories: ProductCategoryOption[]
  onCancel: () => void
  onCreate: (draft: RateCardDraft) => Promise<void>
}

function newRule(): RuleDraft {
  return {
    key: crypto.randomUUID(),
    categoryId: '',
    serviceType: 'first_mile',
    baseCharge: '',
    includedWeightKg: '1',
    additionalWeightKg: '0.5',
    additionalFee: '',
    maxWeightKg: '50',
    maxLengthCm: '200',
    maxWidthCm: '200',
    maxHeightCm: '200',
  }
}

function localDateTime(): string {
  const now = new Date(Date.now() + 5 * 60 * 1000)
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function invalidNumber(value: string, allowZero: boolean): boolean {
  const parsed = Number(value)
  return !Number.isFinite(parsed) || (allowZero ? parsed < 0 : parsed <= 0)
}

function validate(draft: RateCardDraft): string | null {
  if (!draft.effectiveAt || Number.isNaN(new Date(draft.effectiveAt).getTime())) return 'Choose a valid effective date and time.'
  if (!draft.rules.length) return 'Add at least one rate rule.'
  const pairs = new Set<string>()

  for (const rule of draft.rules) {
    if (!rule.categoryId) return 'Select a product category for every rule.'
    const pair = `${rule.categoryId}:${rule.serviceType}`
    if (pairs.has(pair)) return 'Each product category and service type can appear only once.'
    pairs.add(pair)
    if (invalidNumber(rule.baseCharge, true) || invalidNumber(rule.additionalFee, true)) return 'Charges must be valid nonnegative amounts.'
    if ([rule.includedWeightKg, rule.additionalWeightKg, rule.maxWeightKg, rule.maxLengthCm, rule.maxWidthCm, rule.maxHeightCm].some((value) => invalidNumber(value, false))) return 'Weight and dimension limits must be greater than zero.'
  }

  return null
}

function NumericField({ id, label, onChange, step = '0.01', value }: { id: string; label: string; onChange: (value: string) => void; step?: string; value: string }) {
  return <label className="block text-sm font-medium" htmlFor={id}>{label}<input className={`${field} mt-1.5`} id={id} inputMode="decimal" min="0" onChange={(event) => onChange(event.target.value)} required step={step} type="number" value={value} /></label>
}

export function RateCardForm({ categories, onCancel, onCreate }: Props) {
  const [draft, setDraft] = useState<RateCardDraft>({ effectiveAt: localDateTime(), rules: [newRule()] })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function updateRule(key: string, updates: Partial<RuleDraft>) {
    setDraft((current) => ({ ...current, rules: current.rules.map((rule) => rule.key === key ? { ...rule, ...updates } : rule) }))
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validation = validate(draft)
    if (validation) { setError(validation); return }
    setBusy(true)
    setError('')
    try {
      await onCreate(draft)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The rate card could not be created.')
    } finally {
      setBusy(false)
    }
  }

  return <form className="space-y-4" onSubmit={(event) => void submit(event)}>
    <section className={`${panel} p-4 sm:p-5`}>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,22rem)_1fr] sm:items-end">
        <label className="block text-sm font-medium" htmlFor="rate-card-effective">Effective date and time<input className={`${field} mt-1.5`} id="rate-card-effective" onChange={(event) => setDraft((current) => ({ ...current, effectiveAt: event.target.value }))} required type="datetime-local" value={draft.effectiveAt} /></label>
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">Currency is fixed to PHP. The draft is immutable after creation; publish it only after reviewing every rule.</p>
      </div>
    </section>

    <div className="space-y-3">
      {draft.rules.map((rule, index) => <fieldset className={`${panel} p-4 sm:p-5`} key={rule.key}>
        <legend className="sr-only">Rate rule {index + 1}</legend>
        <div className="flex items-center justify-between gap-3"><h4 className="font-semibold">Rate rule {index + 1}</h4><button aria-label={`Remove rate rule ${index + 1}`} className="inline-flex h-9 items-center gap-2 rounded-md px-2.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-300 dark:hover:bg-red-400/10" disabled={draft.rules.length === 1 || busy} onClick={() => setDraft((current) => ({ ...current, rules: current.rules.filter((item) => item.key !== rule.key) }))} type="button"><FaTrash aria-hidden="true" />Remove</button></div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm font-medium" htmlFor={`category-${rule.key}`}>Product category<select className={`${field} mt-1.5`} id={`category-${rule.key}`} onChange={(event) => updateRule(rule.key, { categoryId: event.target.value })} required value={rule.categoryId}><option value="">Select category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.group_name ? `${category.group_name} · ` : ''}{category.name}</option>)}</select></label>
          <label className="block text-sm font-medium" htmlFor={`service-${rule.key}`}>Service leg<select className={`${field} mt-1.5`} id={`service-${rule.key}`} onChange={(event) => updateRule(rule.key, { serviceType: event.target.value as ServiceType })} value={rule.serviceType}>{serviceTypes.map((service) => <option key={service} value={service}>{serviceLabels[service]}</option>)}</select></label>
          <NumericField id={`base-${rule.key}`} label="Base charge (₱)" onChange={(value) => updateRule(rule.key, { baseCharge: value })} value={rule.baseCharge} />
          <NumericField id={`included-${rule.key}`} label="Included weight (kg)" onChange={(value) => updateRule(rule.key, { includedWeightKg: value })} step="0.001" value={rule.includedWeightKg} />
          <NumericField id={`increment-${rule.key}`} label="Additional weight step (kg)" onChange={(value) => updateRule(rule.key, { additionalWeightKg: value })} step="0.001" value={rule.additionalWeightKg} />
          <NumericField id={`fee-${rule.key}`} label="Charge per step (₱)" onChange={(value) => updateRule(rule.key, { additionalFee: value })} value={rule.additionalFee} />
          <NumericField id={`max-weight-${rule.key}`} label="Maximum weight (kg)" onChange={(value) => updateRule(rule.key, { maxWeightKg: value })} step="0.001" value={rule.maxWeightKg} />
          <div className="grid grid-cols-3 gap-2 sm:col-span-2 lg:col-span-1"><NumericField id={`length-${rule.key}`} label="Length (cm)" onChange={(value) => updateRule(rule.key, { maxLengthCm: value })} step="0.1" value={rule.maxLengthCm} /><NumericField id={`width-${rule.key}`} label="Width (cm)" onChange={(value) => updateRule(rule.key, { maxWidthCm: value })} step="0.1" value={rule.maxWidthCm} /><NumericField id={`height-${rule.key}`} label="Height (cm)" onChange={(value) => updateRule(rule.key, { maxHeightCm: value })} step="0.1" value={rule.maxHeightCm} /></div>
        </div>
      </fieldset>)}
    </div>

    <div className="flex flex-wrap items-center justify-between gap-3">
      <ActionButton disabled={busy || !categories.length} onClick={() => setDraft((current) => ({ ...current, rules: [...current.rules, newRule()] }))} type="button"><FaPlus aria-hidden="true" />Add rate rule</ActionButton>
      <div className="flex items-center gap-2"><ActionButton disabled={busy} onClick={onCancel} type="button">Cancel</ActionButton><PrimaryButton busy={busy} disabled={!categories.length} type="submit">Create draft</PrimaryButton></div>
    </div>
    {error ? <p className="border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-200" role="alert">{error}</p> : null}
  </form>
}

