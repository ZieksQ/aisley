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

function newRule(serviceType: ServiceType = 'first_mile'): RuleDraft {
  return {
    key: crypto.randomUUID(),
    categoryId: '',
    serviceType,
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
  if (value.trim() === '') return true
  const parsed = Number(value)
  return !Number.isFinite(parsed) || (allowZero ? parsed < 0 : parsed <= 0)
}

function validate(draft: RateCardDraft): string | null {
  if (!draft.effectiveAt || Number.isNaN(new Date(draft.effectiveAt).getTime())) return 'Choose a valid effective date and time.'
  if (!draft.services.length) return 'Choose at least one service and enter its base fee.'
  if (draft.services.some((service) => invalidNumber(service.baseFee, true))) return 'Enter a zero or positive base fee for every selected service.'
  if (!draft.rules.length) return 'Add at least one category rate rule.'

  const offeredServices = new Set(draft.services.map((service) => service.serviceType))
  const usedServices = new Set<ServiceType>()
  const pairs = new Set<string>()

  for (const rule of draft.rules) {
    if (!rule.categoryId) return 'Select a product category for every rule.'
    if (!offeredServices.has(rule.serviceType)) return 'Every category rule must use an offered service. Select the service above or reassign the rule.'
    const pair = [rule.categoryId, rule.serviceType].join(':')
    if (pairs.has(pair)) return 'Each product category and service type can appear only once.'
    pairs.add(pair)
    usedServices.add(rule.serviceType)
    if (invalidNumber(rule.additionalFee, true)) return 'Enter a zero or positive category extra for every rule.'
    if ([rule.includedWeightKg, rule.additionalWeightKg, rule.maxWeightKg, rule.maxLengthCm, rule.maxWidthCm, rule.maxHeightCm].some((value) => invalidNumber(value, false))) return 'Weight and dimension limits must be greater than zero.'
  }

  if (draft.services.some((service) => !usedServices.has(service.serviceType))) return 'Add at least one category rate rule for every selected service.'
  return null
}

function NumericField({ id, label, onChange, step = '0.01', value }: { id: string; label: string; onChange: (value: string) => void; step?: string; value: string }) {
  return <label className="block text-sm font-medium" htmlFor={id}>{label}<input className={field + ' mt-1.5'} id={id} inputMode="decimal" min="0" onChange={(event) => onChange(event.target.value)} required step={step} type="number" value={value} /></label>
}

export function RateCardForm({ categories, onCancel, onCreate }: Props) {
  const [draft, setDraft] = useState<RateCardDraft>({
    effectiveAt: localDateTime(),
    services: [{ serviceType: 'first_mile', baseFee: '' }],
    rules: [newRule()],
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function updateRule(key: string, updates: Partial<RuleDraft>) {
    setDraft((current) => ({ ...current, rules: current.rules.map((rule) => rule.key === key ? { ...rule, ...updates } : rule) }))
  }

  function updateService(serviceType: ServiceType, checked: boolean) {
    setDraft((current) => ({
      ...current,
      services: checked
        ? [...current.services, { serviceType, baseFee: '' }]
        : current.services.filter((service) => service.serviceType !== serviceType),
    }))
  }

  function updateServiceBase(serviceType: ServiceType, baseFee: string) {
    setDraft((current) => ({
      ...current,
      services: current.services.map((service) => service.serviceType === serviceType ? { ...service, baseFee } : service),
    }))
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
    <section className={panel + ' p-4 sm:p-5'}>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,22rem)_1fr] sm:items-end">
        <label className="block text-sm font-medium" htmlFor="rate-card-effective">Effective date and time<input className={field + ' mt-1.5'} id="rate-card-effective" onChange={(event) => setDraft((current) => ({ ...current, effectiveAt: event.target.value }))} required type="datetime-local" value={draft.effectiveAt} /></label>
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">Currency is fixed to PHP. Each service base is charged once per route leg, including once per linehaul hop.</p>
      </div>
    </section>

    <fieldset className={panel + ' p-4 sm:p-5'}>
      <legend className="px-1 font-semibold">Service base fees</legend>
      <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">Choose the services this card offers and set one base fee for each. Category extras are configured separately below.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {serviceTypes.map((serviceType) => {
          const selected = draft.services.find((service) => service.serviceType === serviceType)
          const inputId = 'service-base-' + serviceType
          return <div className="border border-zinc-200 p-3 dark:border-white/10" key={serviceType}>
            <label className="flex min-h-8 items-center gap-2 text-sm font-medium" htmlFor={inputId + '-enabled'}>
              <input checked={Boolean(selected)} className="size-4 accent-[#4C1268]" id={inputId + '-enabled'} onChange={(event) => updateService(serviceType, event.target.checked)} type="checkbox" />
              {serviceLabels[serviceType]}
            </label>
            {selected ? <label className="mt-3 block text-sm font-medium" htmlFor={inputId}>Base fee (PHP)<input className={field + ' mt-1.5'} id={inputId} inputMode="decimal" min="0" onChange={(event) => updateServiceBase(serviceType, event.target.value)} required step="0.01" type="number" value={selected.baseFee} /></label> : <p className="mt-3 text-sm text-zinc-500">Not offered on this card.</p>}
          </div>
        })}
      </div>
    </fieldset>

    <div className="space-y-3">
      {draft.rules.map((rule, index) => <fieldset className={panel + ' p-4 sm:p-5'} key={rule.key}>
        <legend className="sr-only">Category rate rule {index + 1}</legend>
        <div className="flex items-center justify-between gap-3"><h4 className="font-semibold">Category rate rule {index + 1}</h4><button aria-label={'Remove category rate rule ' + (index + 1)} className="inline-flex h-9 items-center gap-2 rounded-md px-2.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-300 dark:hover:bg-red-400/10" disabled={draft.rules.length === 1 || busy} onClick={() => setDraft((current) => ({ ...current, rules: current.rules.filter((item) => item.key !== rule.key) }))} type="button"><FaTrash aria-hidden="true" />Remove</button></div>
        <p className="mt-1 text-sm text-zinc-500">Set the category's weight extra and parcel limits for one service.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm font-medium" htmlFor={'category-' + rule.key}>Product category<select className={field + ' mt-1.5'} id={'category-' + rule.key} onChange={(event) => updateRule(rule.key, { categoryId: event.target.value })} required value={rule.categoryId}><option value="">Select category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.group_name ? category.group_name + ' · ' : ''}{category.name}</option>)}</select></label>
          <label className="block text-sm font-medium" htmlFor={'service-' + rule.key}>Service leg<select className={field + ' mt-1.5'} id={'service-' + rule.key} onChange={(event) => updateRule(rule.key, { serviceType: event.target.value as ServiceType })} value={rule.serviceType}>{serviceTypes.map((service) => <option key={service} value={service}>{serviceLabels[service]}</option>)}</select></label>
          <NumericField id={'included-' + rule.key} label="Included weight (kg)" onChange={(value) => updateRule(rule.key, { includedWeightKg: value })} step="0.001" value={rule.includedWeightKg} />
          <NumericField id={'increment-' + rule.key} label="Additional weight step (kg)" onChange={(value) => updateRule(rule.key, { additionalWeightKg: value })} step="0.001" value={rule.additionalWeightKg} />
          <NumericField id={'fee-' + rule.key} label="Extra per weight step (PHP)" onChange={(value) => updateRule(rule.key, { additionalFee: value })} value={rule.additionalFee} />
          <NumericField id={'max-weight-' + rule.key} label="Maximum weight (kg)" onChange={(value) => updateRule(rule.key, { maxWeightKg: value })} step="0.001" value={rule.maxWeightKg} />
          <div className="grid grid-cols-3 gap-2 sm:col-span-2 lg:col-span-1"><NumericField id={'length-' + rule.key} label="Length (cm)" onChange={(value) => updateRule(rule.key, { maxLengthCm: value })} step="0.1" value={rule.maxLengthCm} /><NumericField id={'width-' + rule.key} label="Width (cm)" onChange={(value) => updateRule(rule.key, { maxWidthCm: value })} step="0.1" value={rule.maxWidthCm} /><NumericField id={'height-' + rule.key} label="Height (cm)" onChange={(value) => updateRule(rule.key, { maxHeightCm: value })} step="0.1" value={rule.maxHeightCm} /></div>
        </div>
      </fieldset>)}
    </div>

    <div className="flex flex-wrap items-center justify-between gap-3">
      <ActionButton disabled={busy || !categories.length} onClick={() => setDraft((current) => ({ ...current, rules: [...current.rules, newRule(current.services[0]?.serviceType ?? 'first_mile')] }))} type="button"><FaPlus aria-hidden="true" />Add category rule</ActionButton>
      <div className="flex items-center gap-2"><ActionButton disabled={busy} onClick={onCancel} type="button">Cancel</ActionButton><PrimaryButton busy={busy} disabled={!categories.length} type="submit">Create draft</PrimaryButton></div>
    </div>
    {error ? <p className="border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-200" role="alert">{error}</p> : null}
  </form>
}
