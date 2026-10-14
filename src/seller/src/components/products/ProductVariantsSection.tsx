import { IconButton, PortalField, PortalSection } from '@aisley/ui/portal'
import { FaPlus, FaTrash, FaXmark } from 'react-icons/fa6'
import { Link } from 'react-router-dom'
import { VariantShippingOverrides } from './VariantShippingOverrides'
import type { ProductFormState } from './useProductForm'
export function ProductVariantsSection({ state, editing }: { state: ProductFormState; editing: boolean }) {
  return <PortalSection
    id="variants"
    title="Variants"
    description="Add up to three options, then add each sellable combination. Blank prices inherit the Product price."
    action={<button
      className="portal-button"
      onClick={state.addOptionGroup}
      disabled={state.groups.length >= 3}
      type="button">
      <FaPlus aria-hidden="true" />
      Add option
    </button>}>
    <div className="product-options">
      {state.groups.map((group, groupIndex) => <fieldset className="product-option-group" key={groupIndex}>
        <legend className="sr-only">
          {`Option ${groupIndex + 1}`}
        </legend>
        <div className="product-option-heading">
          <PortalField
            label={`Option ${groupIndex + 1} name`}
            value={group.name}
            placeholder="e.g. Color"
            onChange={(event) => state.updateGroupName(groupIndex, event.target.value)} />
          <IconButton label={`Remove option ${groupIndex + 1}`} onClick={() => state.removeOptionGroup(groupIndex)}>
            <FaTrash aria-hidden="true" />
          </IconButton>
        </div>
        <div className="product-option-values">
          {group.values.map((value, valueIndex) => <div className="product-option-value" key={valueIndex}>
            <PortalField
              label={`${group.name || `Option ${groupIndex + 1}`} value ${valueIndex + 1}`}
              value={value}
              placeholder="Value"
              onChange={(event) => state.updateOptionValue(groupIndex, valueIndex, event.target.value)} />
            <IconButton label={`Remove ${group.name || 'option'} value ${valueIndex + 1}`} onClick={() => state.removeOptionValue(groupIndex, valueIndex)}>
              <FaXmark aria-hidden="true" />
            </IconButton>
          </div>)}
          <button
            className="portal-button product-add-value"
            onClick={() => state.addOptionValue(groupIndex)}
            type="button">
            <FaPlus aria-hidden="true" />
            Add value
          </button>
        </div>
      </fieldset>)}
    </div>
    {!state.groups.length && <p className="product-inline-note">
      This product uses one base SKU. Add options when you sell different colors, sizes, or other variations.
    </p>}
    {state.groups.length > 0 && <div className="product-variants-heading">
      <p>
        {`${state.variants.length} ${state.variants.length === 1 ? 'variant' : 'variants'}`}
        <span>
          Adding an option value keeps existing variants.
        </span>
      </p>
      <button
        className="portal-button"
        type="button"
        onClick={state.addVariant}>
        <FaPlus aria-hidden="true" />
        Add variant
      </button>
    </div>}
    <div className="product-variant-list">
      {state.variants.map((variant, index) => {
        const context = state.variantContext(variant)
        return <fieldset className="product-variant" key={variant.key}>
          <legend className="sr-only">
            Variant
            {index + 1}
            :
            {context}
          </legend>
          <div className="product-variant-heading">
            <h4>
              {variant.labels.filter(Boolean).join(' / ') || `Variant ${index + 1}`}
            </h4>
            <IconButton label={`Delete variant ${index + 1}`} onClick={() => state.removeVariant(index)}>
              <FaTrash aria-hidden="true" />
            </IconButton>
          </div>
          <div className="product-variant-fields">
            {state.groups.map((group, groupIndex) => <div className="portal-field" key={groupIndex}>
              <label htmlFor={`${variant.key}-${groupIndex}`}>
                {group.name || 'Option'}
              </label>
              <select
                id={`${variant.key}-${groupIndex}`}
                className="portal-input"
                aria-label={`${context} ${group.name || 'option'}`}
                value={variant.option_value_indexes[groupIndex] >= 0 ? String(variant.option_value_indexes[groupIndex]) : ''}
                onChange={(event) => state.updateVariantOption(index, groupIndex, event.target.value)}>
                <option value="">
                  {`Select ${group.name || 'option'}`}
                </option>
                {group.values.map((value, valueIndex) => <option key={valueIndex} value={valueIndex}>
                  {value || `Value ${valueIndex + 1}`}
                </option>)}
              </select>
            </div>)}
            <PortalField
              label="SKU"
              aria-label={`${context} SKU`}
              className="product-variant-sku"
              value={variant.sku}
              required
              error={state.fieldErrors[`variants.${index}.sku`]?.[0]}
              onChange={(event) => state.updateVariant(index, 'sku', event.target.value)} />
            <PortalField
              label="Price override"
              aria-label={`${context} price override`}
              value={variant.price}
              type="number"
              min=".01"
              step=".01"
              suffix="PHP"
              placeholder={state.form.price || 'Inherit base price'}
              error={state.fieldErrors[`variants.${index}.price`]?.[0]}
              hint={variant.price ? 'Overrides base price' : `Inherits ₱${Number(state.form.price || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`}
              onChange={(event) => state.updateVariant(index, 'price', event.target.value)} />
            <PortalField
              label="Original price override"
              aria-label={`${context} original price override`}
              value={variant.original_price}
              type="number"
              min=".01"
              step=".01"
              suffix="PHP"
              placeholder={state.form.original_price || 'Inherit original price'}
              error={state.fieldErrors[`variants.${index}.original_price`]?.[0]}
              onChange={(event) => state.updateVariant(index, 'original_price', event.target.value)} />
            {editing ? <div className="product-variant-stock">
              <span className="portal-field-label">
                Stock
              </span>
              <p>
                {`${variant.on_hand ?? 0} on hand`}
              </p>
              {variant.inventory_sku_id && <Link className="portal-link" to={`/inventory/${variant.inventory_sku_id}`}>
                Manage inventory
              </Link>}
            </div> : <PortalField
              label="Opening stock"
              aria-label={`${context} opening stock`}
              value={variant.opening_stock}
              type="number"
              min="0"
              error={state.fieldErrors[`variants.${index}.opening_stock`]?.[0]}
              onChange={(event) => state.updateVariant(index, 'opening_stock', event.target.value)} />}
            <div className="product-variant-image">
              <span className="portal-field-label">
                Variant image
              </span>
              <label className="portal-button product-upload-button">
                {variant.image_preview ? 'Replace image' : 'Add image'}
                <input
                  className="sr-only"
                  aria-label={`${context} variant image`}
                  accept="image/jpeg,image/png,image/webp"
                  disabled={Boolean(state.activeUploads)}
                  type="file"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void state.uploadImage(file, 'variant', index)
                    event.target.value = ''
                  }} />
              </label>
            </div>
          </div>
          {Object.entries(state.fieldErrors).filter(([key]) => key.startsWith(`variants.${index}.`) && !['sku', 'price', 'original_price', 'opening_stock'].includes(key.split('.').at(-1) ?? '')).map(([key, messages]) => <p className="portal-field-error" key={key}>
            {messages[0]}
          </p>)}
        </fieldset>
      })}
    </div>
    {state.groups.length > 0 && !state.variants.length && <p className="product-variant-empty">
      No variants yet. Add one sellable combination above.
    </p>}
    {state.variants.length > 0 && <VariantShippingOverrides
      labelFor={(variant) => state.variantContext(variant as typeof state.variants[number])}
      onChange={state.updateVariantShipping}
      onToggle={state.toggleVariantShipping}
      productMeasurements={{
        weight: state.form.shipping_weight_grams,
        length: state.form.shipping_length_mm,
        width: state.form.shipping_width_mm,
        height: state.form.shipping_height_mm
      }}
      variants={state.variants} />}
  </PortalSection>
}
