type ShippingKey = 'shipping_weight_grams' | 'shipping_length_mm' | 'shipping_width_mm' | 'shipping_height_mm'

export type ShippingOverrideVariant = {
  key: string
  sku: string
  shipping_override_enabled: boolean
  shipping_weight_grams: string
  shipping_length_mm: string
  shipping_width_mm: string
  shipping_height_mm: string
  unit_cost: string
}

const fields: Array<{ key: ShippingKey; label: string; unit: string }> = [
  { key: 'shipping_weight_grams', label: 'Packed weight', unit: 'g' },
  { key: 'shipping_length_mm', label: 'Length', unit: 'mm' },
  { key: 'shipping_width_mm', label: 'Width', unit: 'mm' },
  { key: 'shipping_height_mm', label: 'Height', unit: 'mm' },
]

export function VariantShippingOverrides({
  labelFor,
  onChange,
  onToggle,
  productMeasurements,
  variants,
}: {
  labelFor: (variant: ShippingOverrideVariant) => string
  onChange: (index: number, key: ShippingKey | 'unit_cost', value: string) => void
  onToggle: (index: number, enabled: boolean) => void
  productMeasurements: { weight: string; length: string; width: string; height: string }
  variants: ShippingOverrideVariant[]
}) {
  return <div className="space-y-4 border-t border-zinc-200 pt-4 dark:border-white/10">
    <div><h4 className="text-sm font-semibold">Variant package overrides</h4><p className="mt-1 text-xs leading-5 text-zinc-500">Variants use the Product package by default. Turn on an override only when the packed variant is physically different; all four measurements are then required.</p></div>
    <div className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-white/10 dark:border-white/10">{variants.map((variant, index) => {
      const label = labelFor(variant) || variant.sku
      return <fieldset className="py-4" key={variant.key}>
        <legend className="sr-only">Shipping override for {label}</legend>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-sm font-medium">{label}</p><p className="mt-1 font-mono text-xs text-zinc-500">{variant.sku}</p></div>
          <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm font-medium"><input checked={variant.shipping_override_enabled} className="size-4 accent-[#E6007A]" onChange={(event) => onToggle(index, event.target.checked)} type="checkbox" />Use different package</label>
        </div>
        {variant.shipping_override_enabled ? <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{fields.map(({ key, label: fieldLabel, unit }) => <label className="text-xs font-medium" key={key}>{fieldLabel} ({unit})<input aria-label={`${label} ${fieldLabel} in ${unit}`} className="mt-1 h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-[#4C1268] focus:ring-2 focus:ring-[#4C1268]/20 dark:border-white/15 dark:bg-[#111113]" min="1" onChange={(event) => onChange(index, key, event.target.value)} required step="1" type="number" value={variant[key]} /></label>)}</div> : <p className="mt-3 text-xs text-zinc-500">Uses {productMeasurements.weight || '—'} g · {productMeasurements.length || '—'} × {productMeasurements.width || '—'} × {productMeasurements.height || '—'} mm</p>}
        <label className="mt-4 block max-w-48 text-xs font-medium">Unit cost override (PHP)<input className="mt-1 h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-[#4C1268] focus:ring-2 focus:ring-[#4C1268]/20 dark:border-white/15 dark:bg-[#111113]" min="0" onChange={(event) => onChange(index, 'unit_cost', event.target.value)} placeholder="Inherit Product cost" step="0.01" type="number" value={variant.unit_cost} /></label>
      </fieldset>
    })}</div>
  </div>
}
