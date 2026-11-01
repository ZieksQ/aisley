import { useState } from 'react'
import { FaImage } from 'react-icons/fa6'
import './product-thumbnail.css'

export function ProductThumbnail({ src, alt }: { src?: string | null; alt: string }) {
  const [failedUrl, setFailedUrl] = useState('')
  return (
    <div className="portal-product-thumbnail">
      {src && failedUrl !== src ? (
        <img src={src} alt={alt} loading="lazy" onError={() => setFailedUrl(src)} />
      ) : (
        <FaImage aria-label="No product image" role="img" />
      )}
    </div>
  )
}
