import { useEffect, useRef, useState } from 'react'
import { FaCircleExclamation, FaXmark } from 'react-icons/fa6'
import { field } from '../../components/PickupUi'
import { serviceLabels, serviceTypes } from './formatters'
import type { RateCardDraft, RuleDraft, ServiceType, ShopCategoryOption } from './types'

type Props = {
  rule: RuleDraft
  shopCategories: ShopCategoryOption[]
  services: RateCardDraft['services']
  onCancel: () => void
  onSave: (rule: RuleDraft) => string | null
}

type RuleErrors = Partial<Record<keyof Omit<RuleDraft, 'key'> | 'general', string>>

function HelpTooltip({ id, label, text }: { id: string; label: string; text: string }) {
  const tooltipId = `${id}-help`

  return <span className="group relative inline-flex">
    <button aria-describedby={tooltipId} aria-label={`${label} help: ${text}`} className="peer inline-grid size-5 place-items-center rounded-full text-zinc-500 hover:text-[#4C1268] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4C1268] dark:text-zinc-400 dark:hover:text-purple-300" title={text} type="button">
      <FaCircleExclamation aria-hidden="true" className="text-[15px]" />
    </button>
    <span className="pointer-events-none invisible absolute left-0 top-full z-30 mt-1 w-60 border border-zinc-300 bg-white p-2.5 text-left text-xs font-normal leading-5 text-zinc-800 shadow-md group-hover:visible group-focus-within:visible dark:border-white/20 dark:bg-[#27272a] dark:text-zinc-100" id={tooltipId} role="tooltip">{text}</span>
  </span>
}

function validateRule(rule: RuleDraft): RuleErrors {
  const errors: RuleErrors = {}
  if (!rule.shopCategoryId) errors.shopCategoryId = 'Select a main Shop Category.'
  if (!rule.serviceType) errors.serviceType = 'Select a service leg.'

  const positiveFields: Array<[keyof Omit<RuleDraft, 'key'>, string]> = [
    ['includedWeightKg', 'Enter an included weight greater than zero.'],
    ['additionalWeightKg', 'Enter a weight step greater than zero.'],
    ['maxWeightKg', 'Enter a maximum weight greater than zero.'],
    ['maxLengthCm', 'Enter a maximum length greater than zero.'],
    ['maxWidthCm', 'Enter a maximum width greater than zero.'],
    ['maxHeightCm', 'Enter a maximum height greater than zero.'],
  ]
  for (const [key, message] of positiveFields) {
    const value = Number(rule[key])
    if (String(rule[key]).trim() === '' || !Number.isFinite(value) || value <= 0) errors[key] = message
  }

  const extra = Number(rule.additionalFee)
  if (rule.additionalFee.trim() === '' || !Number.isFinite(extra) || extra < 0) {
    errors.additionalFee = 'Enter a zero or positive extra fee.'
  }

  return errors
}

function TooltipLabel({ htmlFor, id, label, text }: { htmlFor: string; id: string; label: string; text: string }) {
  return <span className="mb-1.5 flex min-h-5 items-center gap-1.5 text-sm font-medium">
    <label htmlFor={htmlFor}>{label}</label>
    <HelpTooltip id={id} label={label} text={text} />
  </span>
}

function NumberField({ error, help, id, label, onChange, step = '0.01', value }: {
  error?: string
  help: string
  id: string
  label: string
  onChange: (value: string) => void
  step?: string
  value: string
}) {
  return <div>
    <TooltipLabel htmlFor={id} id={id} label={label} text={help} />
    <input aria-invalid={Boolean(error)} className={`${field} ${error ? 'border-red-500' : ''}`} id={id} inputMode="decimal" min="0" onChange={(event) => onChange(event.target.value)} required step={step} type="number" value={value} />
    {error ? <p className="mt-1 text-xs leading-5 text-red-700 dark:text-red-300">{error}</p> : null}
  </div>
}

export function RateRuleModal({ onCancel, onSave, rule, services, shopCategories }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [draft, setDraft] = useState(rule)
  const [errors, setErrors] = useState<RuleErrors>({})

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    element.showModal()
    return () => { if (element.open) element.close() }
  }, [])

  function setField<K extends keyof Omit<RuleDraft, 'key'>>(key: K, value: RuleDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined, general: undefined }))
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validateRule(draft)
    if (!services.some((service) => service.serviceType === draft.serviceType)) {
      nextErrors.serviceType = 'Add this service and its base fee before using it in a rule.'
    }
    if (Object.values(nextErrors).some(Boolean)) {
      setErrors(nextErrors)
      return
    }

    const error = onSave(draft)
    if (error) setErrors({ general: error })
  }

  return <dialog aria-labelledby="rate-rule-modal-title" className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto border border-zinc-200 bg-white p-0 text-zinc-950 backdrop:bg-black/55 dark:border-white/15 dark:bg-[#18181b] dark:text-white" onCancel={(event) => { event.preventDefault(); onCancel() }} ref={dialog}>
    <form className="space-y-5 p-4 sm:p-6" onSubmit={submit}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold" id="rate-rule-modal-title">{rule.shopCategoryId ? 'Edit' : 'Add'} main Shop Category rate rule</h3>
          <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">Combined item weight is rated against this Shop Category once for the selected service leg.</p>
        </div>
        <button aria-label="Close rate rule dialog" className="grid size-9 shrink-0 place-items-center rounded-md text-zinc-600 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-[#4C1268] dark:text-zinc-300 dark:hover:bg-white/10" onClick={onCancel} type="button"><FaXmark aria-hidden="true" /></button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium" htmlFor="rate-rule-shop-category">Main Shop Category</label>
          <select aria-invalid={Boolean(errors.shopCategoryId)} className={`${field} ${errors.shopCategoryId ? 'border-red-500' : ''}`} id="rate-rule-shop-category" onChange={(event) => setField('shopCategoryId', event.target.value)} required value={draft.shopCategoryId}>
            <option value="">Select a Shop Category</option>
            {shopCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          {errors.shopCategoryId ? <p className="mt-1 text-xs leading-5 text-red-700 dark:text-red-300">{errors.shopCategoryId}</p> : null}
        </div>

        <div>
          <TooltipLabel htmlFor="rate-rule-service" id="rate-rule-service" label="Service leg" text="The stage of delivery this rate applies to: Seller pickup, hub-to-hub linehaul, or delivery to the customer." />
          <select aria-invalid={Boolean(errors.serviceType)} className={`${field} ${errors.serviceType ? 'border-red-500' : ''}`} id="rate-rule-service" onChange={(event) => setField('serviceType', event.target.value as ServiceType)} required value={draft.serviceType}>
            {serviceTypes.map((service) => <option key={service} value={service}>{serviceLabels[service]}</option>)}
          </select>
          {errors.serviceType ? <p className="mt-1 text-xs leading-5 text-red-700 dark:text-red-300">{errors.serviceType}</p> : null}
        </div>

        <NumberField error={errors.includedWeightKg} help="The combined billable parcel weight covered before extra weight charges begin." id="rate-rule-included-weight" label="Included weight (kg)" onChange={(value) => setField('includedWeightKg', value)} step="0.001" value={draft.includedWeightKg} />
        <NumberField error={errors.additionalWeightKg} help="Each weight increment above the included weight adds one extra fee." id="rate-rule-weight-step" label="Additional weight step (kg)" onChange={(value) => setField('additionalWeightKg', value)} step="0.001" value={draft.additionalWeightKg} />
        <NumberField error={errors.additionalFee} help="The amount charged for each additional weight step." id="rate-rule-extra-fee" label="Extra per weight step (PHP)" onChange={(value) => setField('additionalFee', value)} value={draft.additionalFee} />
        <NumberField error={errors.maxWeightKg} help="The greatest combined billable weight this service accepts for this Shop Category." id="rate-rule-max-weight" label="Maximum weight (kg)" onChange={(value) => setField('maxWeightKg', value)} step="0.001" value={draft.maxWeightKg} />
        <NumberField error={errors.maxLengthCm} help="The largest allowed length measurement for an item package in the parcel." id="rate-rule-max-length" label="Maximum length (cm)" onChange={(value) => setField('maxLengthCm', value)} step="0.1" value={draft.maxLengthCm} />
        <NumberField error={errors.maxWidthCm} help="The largest allowed width measurement for an item package in the parcel." id="rate-rule-max-width" label="Maximum width (cm)" onChange={(value) => setField('maxWidthCm', value)} step="0.1" value={draft.maxWidthCm} />
        <NumberField error={errors.maxHeightCm} help="The largest allowed height measurement for an item package in the parcel." id="rate-rule-max-height" label="Maximum height (cm)" onChange={(value) => setField('maxHeightCm', value)} step="0.1" value={draft.maxHeightCm} />
      </div>

      {errors.general ? <p className="border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-200" role="alert">{errors.general}</p> : null}
      <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-200 pt-4 dark:border-white/10">
        <button className="min-h-10 rounded-md border border-zinc-300 px-3 text-sm font-medium hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4C1268] dark:border-white/20 dark:hover:bg-white/10" onClick={onCancel} type="button">Cancel</button>
        <button className="min-h-10 rounded-md bg-[#4C1268] px-4 text-sm font-semibold text-white hover:bg-[#3c0e52] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4C1268]" type="submit">Save rate rule</button>
      </div>
    </form>
  </dialog>
}
