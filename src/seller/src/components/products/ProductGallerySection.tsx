import { IconButton, PortalSection } from '@aisley/ui/portal'
import { FaCheck, FaImage, FaTrash, FaUpload } from 'react-icons/fa6'
import type { ProductFormState } from './useProductForm'
export function ProductGallerySection({ state }: { state: ProductFormState }) {
  const images = [...state.existingGallery.map((image, index) => ({
    id: image.id,
    name: `Gallery image ${index + 1}`,
    temporary: false
  })), ...state.galleryUploads.map((image) => ({ ...image, temporary: true }))]
  const defaultId = state.defaultGalleryId ?? images[0]?.id
  const full = images.length >= state.limits.gallery_images
  return <PortalSection
    id="gallery"
    title="Product gallery"
    description={`Up to ${state.limits.gallery_images} images. Choose a default cover for Customer product cards. Variant images are separate.`}
    action={<span className="product-section-count">
      {images.length}
      /
      {state.limits.gallery_images}
    </span>}>
    <label className={`product-upload-area ${full || state.activeUploads ? 'is-disabled' : ''}`}>
      <FaUpload aria-hidden="true" />
      <span className="product-upload-title">
        {full ? 'Gallery limit reached' : 'Add gallery images'}
      </span>
      <span className="product-upload-hint">
        JPEG, PNG, or WebP · under 10 MiB each
      </span>
      <input
        accept="image/jpeg,image/png,image/webp"
        aria-label="Add gallery images"
        className="sr-only"
        disabled={full || Boolean(state.activeUploads)}
        multiple
        type="file"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []).slice(0, state.limits.gallery_images - images.length)
          for (const file of files) void state.uploadImage(file, 'gallery')
          event.target.value = ''
        }} />
    </label>
    {images.length > 0 && <ol className="product-gallery-files">
      {images.map((image, index) => <li key={image.id}>
        <FaImage aria-hidden="true" />
        <div className="product-gallery-file-name">
          <p>
            {image.name}
          </p>
          <span>
            {image.id === defaultId ? 'Default cover' : `Gallery image ${index + 1}`}
            {image.temporary ? ' · Pending save' : ''}
          </span>
        </div>
        <div className="product-gallery-file-actions">
          {image.id === defaultId ? <span className="product-default-marker">
            <FaCheck aria-hidden="true" />
            Default
          </span> : <button
            className="portal-button product-tertiary-button"
            type="button"
            onClick={() => state.selectDefaultGallery(image.id)}>
            Set default
          </button>}
          <IconButton label={`Delete ${image.name}`} onClick={() => state.removeGalleryItem(image.id, image.temporary)}>
            <FaTrash aria-hidden="true" />
          </IconButton>
        </div>
      </li>)}
    </ol>}
    <p className="product-upload-status" aria-live="polite">
      {state.uploadStatus || 'Maximum 8,000 px per edge and 40 MP. Images are finalized when you save.'}
    </p>
  </PortalSection>
}
