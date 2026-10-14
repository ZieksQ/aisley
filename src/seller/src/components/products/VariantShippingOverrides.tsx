import { PortalField } from '@aisley/ui/portal'
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
  {
    key: 'shipping_weight_grams',
    label: 'Packed weight',
    unit: 'g'
  },
  {
    key: 'shipping_length_mm',
    label: 'Length',
    unit: 'mm'
  },
  {
    key: 'shipping_width_mm',
    label: 'Width',
    unit: 'mm'
  },
  {
    key: 'shipping_height_mm',
    label: 'Height',
    unit: 'mm'
  },
]
export function VariantShippingOverrides({ labelFor, onChange, onToggle, productMeasurements, variants }: {
  labelFor: (variant: ShippingOverrideVariant) => string
  onChange: (index: number, key: ShippingKey | 'unit_cost', value: string) => void
  onToggle: (index: number, enabled: boolean) => void
  productMeasurements: { weight: string; length: string; width: string; height: string }
  variants: ShippingOverrideVariant[]
}) {
  return <div className="product-shipping-overrides">
    <h4>
      Variant package overrides
    </h4>
    <p>
      Variants use the Product package by default. Turn on an override only when the packed variant is physically different; all four measurements are then required.
    </p>
    {variants.map((variant, index) => {
      const label = labelFor(variant) || variant.sku
      return <fieldset key={variant.key}>
        <legend className="sr-only">
          {`Shipping override for ${label}`}
        </legend>
        <div className="product-shipping-override-heading">
          <div>
            <p>
              {label}
            </p>
            <span>
              {variant.sku}
            </span>
          </div>
          <label>
            <input
              checked={variant.shipping_override_enabled}
              onChange={(event) => onToggle(index, event.target.checked)}
              type="checkbox" />
            Use different package
          </label>
        </div>
        {variant.shipping_override_enabled ? <div className="product-fields product-fields-four">
          {fields.map(({ key, label: fieldLabel, unit }) => <PortalField
            key={key}
            label={`${fieldLabel} (${unit})`}
            aria-label={`${label} ${fieldLabel} in ${unit}`}
            suffix={unit}
            min="1"
            required
            step="1"
            type="number"
            value={variant[key]}
            onChange={(event) => onChange(index, key, event.target.value)} />)}
        </div> : <p className="product-inline-note">
          {`Uses ${productMeasurements.weight || '—'} g · ${productMeasurements.length || '—'} × ${productMeasurements.width || '—'} × ${productMeasurements.height || '—'} mm`}
        </p>}
        <PortalField
          label="Unit cost override (PHP)"
          aria-label={`${label} unit cost override (PHP)`}
          min="0"
          step=".01"
          type="number"
          suffix="PHP"
          value={variant.unit_cost}
          placeholder="Inherit Product cost"
          onChange={(event) => onChange(index, 'unit_cost', event.target.value)} />
      </fieldset>
    })}
  </div>
}
