import { FaPlus } from 'react-icons/fa6'
import { ActionButton, panel } from '../../components/PickupUi'
import { centimeters, kilograms, peso, serviceLabels } from './formatters'
import type { RuleDraft, ServiceType, ShopCategoryOption } from './types'

type Props = {
  rules: RuleDraft[]
  shopCategories: ShopCategoryOption[]
  disabled: boolean
  onAdd: (trigger: HTMLButtonElement) => void
  onEdit: (rule: RuleDraft, trigger: HTMLButtonElement) => void
  onRemove: (key: string) => void
}

function numeric(value: string): number | null {
  const parsed = Number(value)
  return value.trim() !== '' && Number.isFinite(parsed) ? parsed : null
}

function kg(value: string): string {
  const parsed = numeric(value)
  return parsed === null ? '—' : kilograms(Math.round(parsed * 1000))
}

function cm(value: string): string {
  const parsed = numeric(value)
  return parsed === null ? '—' : centimeters(Math.round(parsed * 10))
}

function fee(value: string): string {
  const parsed = numeric(value)
  return parsed === null ? '—' : peso(Math.round(parsed * 100))
}

export function RateRuleTable({ disabled, onAdd, onEdit, onRemove, rules, shopCategories }: Props) {
  const names = new Map(shopCategories.map((category) => [category.id, category.name]))

  return <section className={panel + ' overflow-hidden'}>
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 p-4 dark:border-white/10 sm:p-5">
      <div>
        <h3 className="font-semibold">Main Shop Category rate rules</h3>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">Different Product Categories in the same parcel use their Shop's one main category. Their billable weights are combined for that category rule.</p>
      </div>
      <ActionButton disabled={disabled || !shopCategories.length} onClick={(event) => onAdd(event.currentTarget)} type="button"><FaPlus aria-hidden="true" />Add rate rule</ActionButton>
    </div>

    {rules.length ? <div aria-label="Main Shop Category rate rules" className="overflow-x-auto" tabIndex={0}>
      <table className="w-full min-w-[68rem] text-left text-sm">
        <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-white/[0.03]">
          <tr>
            <th className="px-4 py-3 font-medium sm:px-5">Main Shop Category</th>
            <th className="px-4 py-3 font-medium">Service leg</th>
            <th className="px-4 py-3 font-medium">Included weight</th>
            <th className="px-4 py-3 font-medium">Weight step</th>
            <th className="px-4 py-3 font-medium">Extra per step</th>
            <th className="px-4 py-3 font-medium">Maximum weight</th>
            <th className="px-4 py-3 font-medium">Max dimensions</th>
            <th className="px-4 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => <tr className="border-t border-zinc-200 align-top dark:border-white/10" key={rule.key}>
            <th className="px-4 py-3 font-medium sm:px-5">{names.get(rule.shopCategoryId) ?? 'Select a Shop Category'}</th>
            <td className="px-4 py-3">{serviceLabels[rule.serviceType as ServiceType]}</td>
            <td className="px-4 py-3">{kg(rule.includedWeightKg)}</td>
            <td className="px-4 py-3">{kg(rule.additionalWeightKg)}</td>
            <td className="px-4 py-3">{fee(rule.additionalFee)}</td>
            <td className="px-4 py-3">{kg(rule.maxWeightKg)}</td>
            <td className="px-4 py-3">{cm(rule.maxLengthCm)} × {cm(rule.maxWidthCm)} × {cm(rule.maxHeightCm)}</td>
            <td className="px-4 py-3"><div className="flex justify-end gap-2">
              <ActionButton disabled={disabled} onClick={(event) => onEdit(rule, event.currentTarget)} type="button">Edit</ActionButton>
              <ActionButton disabled={disabled} onClick={() => onRemove(rule.key)} type="button">Remove</ActionButton>
            </div></td>
          </tr>)}
        </tbody>
      </table>
    </div> : <p className="p-5 text-sm text-zinc-500">No rate rules added. Add one for each main Shop Category and service leg you offer.</p>}
  </section>
}
