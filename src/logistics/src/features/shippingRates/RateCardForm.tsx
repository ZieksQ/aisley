import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { FlatpickrInput } from '../../components/FlatpickrInput'
import { ActionButton, PrimaryButton, field, panel } from '../../components/PickupUi'
import { serviceLabels, serviceTypes } from './formatters'
import { RateRuleModal } from './RateRuleModal'
import { RateRuleTable } from './RateRuleTable'
import type { RateCardDraft, RuleDraft, ServiceType, ShopCategoryOption } from './types'

type Props = {
  shopCategories: ShopCategoryOption[]
  onCancel: () => void
  onCreate: (draft: RateCardDraft) => Promise<void>
}

function newRule(serviceType: ServiceType = 'first_mile'): RuleDraft {
  return {
    key: crypto.randomUUID(),
    shopCategoryId: '',
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
  return local.toISOString().slice(0, 16).replace('T', ' ')
}

function invalidNumber(value: string, allowZero: boolean): boolean {
  if (value.trim() === '') return true
  const parsed = Number(value)
  return !Number.isFinite(parsed) || (allowZero ? parsed < 0 : parsed <= 0)
}

function validate(draft: RateCardDraft): string | null {
  const effectiveAt = new Date(draft.effectiveAt.replace(' ', 'T'))
  if (!draft.effectiveAt || Number.isNaN(effectiveAt.getTime())) return 'Choose a valid effective date and time.'
  if (!draft.services.length) return 'Choose at least one service and enter its base fee.'
  if (draft.services.some((service) => invalidNumber(service.baseFee, true))) return 'Enter a zero or positive base fee for every selected service.'
  if (!draft.rules.length) return 'Add at least one main Shop Category rate rule.'

  const offeredServices = new Set(draft.services.map((service) => service.serviceType))
  const usedServices = new Set<ServiceType>()
  const pairs = new Set<string>()

  for (const rule of draft.rules) {
    if (!rule.shopCategoryId) return 'Select a main Shop Category for every rule.'
    if (!offeredServices.has(rule.serviceType)) return 'Every Shop Category rule must use an offered service. Add the service and its base fee or reassign the rule.'
    const pair = [rule.shopCategoryId, rule.serviceType].join(':')
    if (pairs.has(pair)) return 'Each main Shop Category and service leg can appear only once.'
    pairs.add(pair)
    usedServices.add(rule.serviceType)
    if (invalidNumber(rule.additionalFee, true)) return 'Enter a zero or positive extra fee for every rule.'
    if ([rule.includedWeightKg, rule.additionalWeightKg, rule.maxWeightKg, rule.maxLengthCm, rule.maxWidthCm, rule.maxHeightCm].some((value) => invalidNumber(value, false))) return 'Weight and dimension limits must be greater than zero.'
  }

  if (draft.services.some((service) => !usedServices.has(service.serviceType))) return 'Add at least one main Shop Category rate rule for every selected service.'
  return null
}

export function RateCardForm({ onCancel, onCreate, shopCategories }: Props) {
  const [draft, setDraft] = useState<RateCardDraft>({
    effectiveAt: localDateTime(),
    services: [{ serviceType: 'first_mile', baseFee: '' }],
    rules: [],
  })
  const [ruleBeingEdited, setRuleBeingEdited] = useState<RuleDraft | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const modalReturnTarget = useRef<HTMLElement | null>(null)

  function closeRuleModal() {
    setRuleBeingEdited(null)
    requestAnimationFrame(() => {
      modalReturnTarget.current?.focus()
      modalReturnTarget.current = null
    })
  }

  function openAddRule(trigger: HTMLButtonElement) {
    modalReturnTarget.current = trigger
    setRuleBeingEdited(newRule(draft.services[0]?.serviceType ?? 'first_mile'))
  }

  function openEditRule(rule: RuleDraft, trigger: HTMLButtonElement) {
    modalReturnTarget.current = trigger
    setRuleBeingEdited(rule)
  }

  function saveRule(rule: RuleDraft): string | null {
    if (!draft.services.some((service) => service.serviceType === rule.serviceType)) {
      return 'Add this service and its base fee before using it in a rate rule.'
    }
    const duplicate = draft.rules.some((existing) => existing.key !== rule.key
      && existing.shopCategoryId === rule.shopCategoryId
      && existing.serviceType === rule.serviceType)
    if (duplicate) return 'A rule already exists for this Shop Category and service leg.'

    setDraft((current) => ({
      ...current,
      rules: current.rules.some((existing) => existing.key === rule.key)
        ? current.rules.map((existing) => existing.key === rule.key ? rule : existing)
        : [...current.rules, rule],
    }))
    closeRuleModal()
    return null
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

  async function submit(event: FormEvent<HTMLFormElement>) {
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

  return <>
    <form className="space-y-4" onSubmit={(event) => void submit(event)}>
      <section className={panel + ' p-4 sm:p-5'}>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,22rem)_1fr] sm:items-end">
          <label className="block text-sm font-medium" htmlFor="rate-card-effective">Effective date and time
            <FlatpickrInput className={field + ' mt-1.5'} id="rate-card-effective" onChange={(value) => setDraft((current) => ({ ...current, effectiveAt: value }))} options={{ dateFormat: 'Y-m-d H:i', enableTime: true, minDate: 'today', minuteIncrement: 15, time_24hr: true }} placeholder="Select date and time" required value={draft.effectiveAt} />
          </label>
          <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">Choose the date and time this immutable rate card starts. Each service base is charged once per leg, including once per linehaul hop.</p>
        </div>
      </section>

      <fieldset className={panel + ' p-4 sm:p-5'}>
        <legend className="px-1 font-semibold">Service base fees</legend>
        <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">Choose the services this card offers and set one base fee for each. Main Shop Category extras are configured in the rate-rule table below.</p>
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

      <RateRuleTable
        disabled={busy}
        onAdd={openAddRule}
        onEdit={openEditRule}
        onRemove={(key) => {
          if (window.confirm('Remove this unsaved rate rule?')) {
            setDraft((current) => ({ ...current, rules: current.rules.filter((rule) => rule.key !== key) }))
          }
        }}
        rules={draft.rules}
        shopCategories={shopCategories}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ActionButton disabled={busy} onClick={onCancel} type="button">Cancel</ActionButton>
        <PrimaryButton busy={busy} disabled={!shopCategories.length} type="submit">Create draft</PrimaryButton>
      </div>
      {error ? <p className="border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-200" role="alert">{error}</p> : null}
    </form>

    {ruleBeingEdited && typeof document !== 'undefined' ? createPortal(
      <RateRuleModal key={ruleBeingEdited.key} onCancel={closeRuleModal} onSave={saveRule} rule={ruleBeingEdited} services={draft.services} shopCategories={shopCategories} />,
      document.body,
    ) : null}
  </>
}
