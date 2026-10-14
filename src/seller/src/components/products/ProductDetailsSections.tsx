import { PortalField, PortalSection } from '@aisley/ui/portal'
import type { ProductFormState } from './useProductForm'
import type { emptyProductForm } from '../../types/productForm'
export function ProductField({ state, name, label, required = false, type = 'text', suffix, hint, disabled = false }: {
  state: ProductFormState
  name: keyof typeof emptyProductForm
  label: string
  required?: boolean
  type?: string
  suffix?: string
  hint?: string
  disabled?: boolean
}) {
  return <PortalField
    id={`product-${name}`}
    label={label}
    value={state.form[name]}
    required={required}
    type={type}
    suffix={suffix}
    hint={hint}
    disabled={disabled}
    error={state.fieldErrors[name]?.[0]}
    min={type === 'number' ? name.includes('price') ? '.01' : name.startsWith('shipping_') ? '1' : '0' : undefined}
    step={name.includes('price') || name === 'unit_cost' ? '.01' : undefined}
    onChange={(event) => state.updateField(name, event.target.value)} />
}
export function ProductDetailsSection({ state }: { state: ProductFormState }) {
  return <PortalSection
    id="details"
    title="Product details"
    description="Start with the information buyers use to find your product.">
    <div className="product-fields">
      <ProductField
        state={state}
        name="name"
        label="Product name"
        required />
      <div className="portal-field">
        <label htmlFor="product-category">
          Category
          <span className="portal-required" aria-hidden="true">
            *
          </span>
        </label>
        <select
          id="product-category"
          className="portal-input"
          required
          value={state.form.category_id}
          aria-invalid={Boolean(state.fieldErrors.category_id?.length)}
          aria-describedby={state.fieldErrors.category_id?.length ? 'product-category-error' : undefined}
          onChange={(event) => state.updateField('category_id', event.target.value)}>
          <option value="">
            Select category
          </option>
          {state.categories.map((category) => <option key={category.id} value={category.id}>
            {category.name}
          </option>)}
        </select>
        {state.fieldErrors.category_id?.[0] && <p className="portal-field-error" id="product-category-error">
          {state.fieldErrors.category_id[0]}
        </p>}
      </div>
      <div className="portal-field">
        <div className="product-label-row">
          <label htmlFor="product-short-description" className="portal-field-label">
            Short description
          </label>
          <span>
            {state.form.short_description.length}
            /500
          </span>
        </div>
        <textarea
          id="product-short-description"
          className="portal-input"
          rows={3}
          maxLength={500}
          value={state.form.short_description}
          onChange={(event) => state.updateField('short_description', event.target.value)}
          aria-invalid={Boolean(state.fieldErrors.short_description?.length)}
          aria-describedby={state.fieldErrors.short_description?.length ? 'product-short-description-error' : undefined} />
        {state.fieldErrors.short_description?.[0] && <p className="portal-field-error" id="product-short-description-error">
          {state.fieldErrors.short_description[0]}
        </p>}
      </div>
    </div>
  </PortalSection>
}
export function ProductPricingSection({ state, editing }: { state: ProductFormState; editing: boolean }) {
  return <PortalSection
    id="pricing"
    title="Pricing & inventory"
    description="Set the regular selling price and starting stock for your listing.">
    <div className="product-fields product-fields-two">
      <ProductField
        state={state}
        name="price"
        label="Base price (PHP)"
        required
        type="number"
        suffix="PHP" />
      <ProductField
        state={state}
        name="original_price"
        label="Original price (optional)"
        type="number"
        suffix="PHP" />
      <ProductField
        state={state}
        name="sku"
        label="Base SKU"
        required
        disabled={editing} />
      {!state.groups.length ? <ProductField
        state={state}
        name="opening_stock"
        label="Opening stock"
        required
        type="number"
        disabled={editing}
        hint={editing ? 'Adjust stock through Inventory.' : undefined} /> : <p className="product-inline-note">
        Opening stock is set separately for each variant below.
      </p>}
      <ProductField
        state={state}
        name="unit_cost"
        label="Unit cost (PHP)"
        type="number"
        suffix="PHP" />
    </div>
  </PortalSection>
}
export function ProductShippingSection({ state }: { state: ProductFormState }) {
  return <PortalSection
    id="shipping"
    title="Packed package"
    description="Measure the parcel after protective packaging. These defaults determine the Customer shipping quote.">
    <div className="product-fields product-fields-four">
      <ProductField
        state={state}
        name="shipping_weight_grams"
        label="Packed weight (g)"
        required
        type="number"
        suffix="g" />
      <ProductField
        state={state}
        name="shipping_length_mm"
        label="Length (mm)"
        required
        type="number"
        suffix="mm" />
      <ProductField
        state={state}
        name="shipping_width_mm"
        label="Width (mm)"
        required
        type="number"
        suffix="mm" />
      <ProductField
        state={state}
        name="shipping_height_mm"
        label="Height (mm)"
        required
        type="number"
        suffix="mm" />
    </div>
    <p className="product-package-note">
      Use the outermost length, width, and height. Incorrect measurements can make a provider unavailable or produce the wrong checkout rate.
    </p>
  </PortalSection>
}
