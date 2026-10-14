import { useEffect, useRef, useState } from 'react'
import { ConfirmationDialog, PortalSection } from '@aisley/ui/portal'
import { FaArrowLeft, FaCheck, FaRegFloppyDisk } from 'react-icons/fa6'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ProductDescriptionEditor } from '../components/products/ProductDescriptionEditor'
import { ProductDetailsSection, ProductPricingSection, ProductShippingSection } from '../components/products/ProductDetailsSections'
import { ProductGallerySection } from '../components/products/ProductGallerySection'
import { ProductVariantsSection } from '../components/products/ProductVariantsSection'
import { useProductForm } from '../components/products/useProductForm'
import '../components/products/products.css'
import '../components/products/product-editor.css'
const sections = [{ id: 'details', label: 'Product details' }, { id: 'gallery', label: 'Product gallery' }, { id: 'description', label: 'Description' }, { id: 'pricing', label: 'Pricing & inventory' }, { id: 'variants', label: 'Variants' }, { id: 'shipping', label: 'Packed package' }]
export function ProductFormPage() {
  const { productId } = useParams()
  return <ProductEditor key={productId ?? 'new'} productId={productId} />
}
function ProductEditor({ productId }: { productId?: string }) {
  const state = useProductForm(productId)
  const navigate = useNavigate()
  const [discarding, setDiscarding] = useState(false)
  const [activeSection, setActiveSection] = useState('details')
  const formElement = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (!state.error) return
    const invalid = formElement.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
    if (invalid) {
      invalid.scrollIntoView({ block: 'center' })
      invalid.focus({ preventScroll: true })
    } else {
      formElement.current?.querySelector('.product-error')?.scrollIntoView({ block: 'center' })
    }
  }, [state.error, state.saving])
  useEffect(() => {
    if (state.loading || state.loadError) return
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting)
      const section = visible.at(-1)
      if (section) setActiveSection(section.target.id)
    }, { rootMargin: '-80px 0px -65% 0px', threshold: 0 })
    for (const section of sections) {
      const element = document.getElementById(section.id)
      if (element) observer.observe(element)
    }
    return () => observer.disconnect()
  }, [state.loading, state.loadError])
  function leave(event: React.MouseEvent<HTMLAnchorElement>) {
    if (state.saving) {
      event.preventDefault()
      return
    }
    if (state.dirty) {
      event.preventDefault()
      setDiscarding(true)
    }
  }
  return (
    <div className="portal-page product-workspace product-editor-workspace">
      <Link
        className="product-back-link"
        to="/products"
        onClick={leave}>
        <FaArrowLeft aria-hidden="true" />
        Products
      </Link>
      <header className="product-page-header">
        <div>
          <h2 className="portal-page-heading">
            {productId ? 'Edit product' : 'Add product'}
          </h2>
          <p>
            Listings begin as drafts. Stock changes after creation belong in Inventory.
          </p>
        </div>
      </header>
      {state.loading ? <div
        className="product-editor-skeleton"
        role="status"
        aria-label="Loading product">
        <div />
        <div />
        <div />
      </div> : state.loadError ? <div className="product-error" role="alert">
        <span>
          {state.loadError}
        </span>
        <button className="portal-button" onClick={state.retry}>
          Try again
        </button>
      </div> : <form ref={formElement} onSubmit={state.submit} className="product-editor-form">
        <div className="product-editor-layout">
          <aside className="product-editor-index">
            <nav aria-label="Product form sections">
              {sections.map((section, index) => <a
                key={section.id}
                href={`#${section.id}`}
                aria-current={activeSection === section.id ? 'location' : undefined}
                onClick={() => setActiveSection(section.id)}>
                <span aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                {section.label}
              </a>)}
            </nav>
            <p>
              {'Fields marked * are required.'}
            </p>
          </aside>
          <fieldset disabled={state.saving} className="product-editor-sections">
            <legend className="sr-only">
              {productId ? 'Edit product' : 'New product'}
            </legend>
            {state.error && <div className="product-error" role="alert">
              {state.error}
            </div>}
            <ProductDetailsSection state={state} />
            <ProductGallerySection state={state} />
            <PortalSection
              id="description"
              title="Description"
              description="Describe materials, fit, care instructions, and other useful details. Rich text is saved as safe Markdown.">
              <ProductDescriptionEditor
                markdown={state.form.description_markdown}
                onAsset={state.addDescriptionAsset}
                onChange={(value) => state.updateField('description_markdown', value)}
                uploadToken={state.uploadToken}
                onUploadState={state.descriptionUploading}
                readOnly={state.saving} />
              {state.fieldErrors.description_markdown?.[0] && <p className="portal-field-error">
                {state.fieldErrors.description_markdown[0]}
              </p>}
              <p className="product-inline-note">
                Images uploaded before the first save remain temporary for 24 hours.
              </p>
            </PortalSection>
            <ProductPricingSection state={state} editing={Boolean(productId)} />
            <ProductVariantsSection state={state} editing={Boolean(productId)} />
            <ProductShippingSection state={state} />
          </fieldset>
        </div>
        <div className="product-save-bar">
          <p aria-live="polite">
            <FaCheck aria-hidden="true" />
            {state.saving ? 'Saving product…' : state.activeUploads ? 'Uploading images…' : state.dirty ? 'Unsaved changes' : productId ? 'No unsaved changes' : 'New product draft'}
          </p>
          <div>
            <Link
              className="portal-button product-tertiary-button"
              to="/products"
              onClick={leave}
              aria-disabled={state.saving}
              tabIndex={state.saving ? -1 : undefined}>
              Cancel
            </Link>
            <button
              className="portal-button portal-button-primary"
              type="submit"
              disabled={state.saving || Boolean(state.activeUploads)}
              aria-busy={state.saving}>
              <FaRegFloppyDisk aria-hidden="true" />
              {state.saving ? 'Saving…' : productId ? 'Save changes' : 'Save draft'}
            </button>
          </div>
        </div>
      </form>}
      {discarding && <ConfirmationDialog
        title="Discard unsaved changes?"
        confirmLabel="Discard changes"
        destructive
        onClose={() => setDiscarding(false)}
        onConfirm={() => navigate('/products')}>
        <p>
          Your unsaved product changes will be lost.
        </p>
      </ConfirmationDialog>}
    </div>
  )
}
