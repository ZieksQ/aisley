import { useState } from 'react'
import { IconButton } from '@aisley/ui/portal'
import { FaBoxArchive, FaImage, FaPen, FaRotateLeft, FaUpload } from 'react-icons/fa6'
import { Link } from 'react-router-dom'
import { apiAssetUrl } from '../../lib/api'
import type { Product } from '../../types/operations'
function ProductThumbnail({ product }: { product: Product }) {
  const image = product.gallery.find((item) => item.is_default) ?? product.gallery[0]
  const [failedUrl, setFailedUrl] = useState('')
  const imageUrl = image?.url ? (/^https?:\/\//i.test(image.url) ? image.url : apiAssetUrl(image.url)) : ''
  return <div className="product-thumbnail">
    {imageUrl && failedUrl !== imageUrl ? <img
      alt={image.alt_text || product.name}
      src={imageUrl}
      loading="lazy"
      onError={() => setFailedUrl(imageUrl)} /> : <FaImage aria-label="No product image" role="img" />}
  </div>
}
export function ProductTable({ products, busy, busyId, onPublish, onArchive, onUnarchive }: {
  products: Product[]
  busy: boolean
  busyId: string | null
  onPublish: (product: Product) => void
  onArchive: (product: Product) => void
  onUnarchive: (product: Product) => void
}) {
  return (
    <div
      className="product-table-scroll"
      role="region"
      aria-label="Products table"
      tabIndex={0}>
      <table className="product-table">
        <thead>
          <tr>
            <th scope="col">
              Product
            </th>
            <th scope="col">
              Status
            </th>
            <th scope="col">
              Price
            </th>
            <th scope="col">
              Available
            </th>
            <th scope="col" className="product-actions-heading">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const available = product.skus.reduce((count, sku) => count + sku.available, 0)
            return <tr key={product.id} aria-busy={busyId === product.id}>
              <td>
                <div className="product-table-identity">
                  <ProductThumbnail product={product} />
                  <div>
                    <Link className="product-name" to={`/products/${product.id}/edit`}>
                      {product.name}
                    </Link>
                    <p>
                      {`${product.category ?? 'No category'} · ${product.base_sku}`}
                    </p>
                  </div>
                </div>
              </td>
              <td>
                <span className={`product-status product-status-${product.status}`}>
                  {product.status === 'active' ? 'Active' : product.status === 'draft' ? 'Draft' : 'Archived'}
                </span>
              </td>
              <td className="product-price">
                ₱
                {Number(product.price).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td>
                <span className={available === 0 ? 'product-stock-empty' : ''}>
                  {available.toLocaleString()}
                </span>
              </td>
              <td>
                <div className="product-row-actions">
                  <Link
                    className="portal-icon-action"
                    aria-label={`Edit ${product.name}`}
                    to={`/products/${product.id}/edit`}>
                    <FaPen aria-hidden="true" />
                    <span className="portal-action-tooltip" aria-hidden="true">
                      Edit product
                    </span>
                  </Link>
                  {product.status === 'draft' && <IconButton
                    label={`Publish ${product.name}`}
                    className="product-publish-action"
                    disabled={busy}
                    onClick={() => onPublish(product)}>
                    <FaUpload aria-hidden="true" />
                  </IconButton>}
                  {product.status !== 'archived' ? <IconButton
                    label={`Archive ${product.name}`}
                    disabled={busy}
                    onClick={() => onArchive(product)}>
                    <FaBoxArchive aria-hidden="true" />
                  </IconButton> : <IconButton
                    label={`Unarchive ${product.name}`}
                    disabled={busy}
                    onClick={() => onUnarchive(product)}>
                    <FaRotateLeft aria-hidden="true" />
                  </IconButton>}
                </div>
              </td>
            </tr>
          })}
        </tbody>
      </table>
    </div>
  )
}
