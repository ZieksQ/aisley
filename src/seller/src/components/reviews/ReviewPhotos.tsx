import { useEffect, useState } from 'react'
import { apiBlobRequest } from '../../lib/api'
import type { SellerReviewPhoto } from '../../types/reviews'

function PrivateReviewPhoto({ photo, position }: { photo: SellerReviewPhoto; position: number }) {
  const [source, setSource] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    let objectUrl = ''
    setSource('')
    setFailed(false)

    apiBlobRequest(photo.url)
      .then((blob) => {
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setSource(objectUrl)
      })
      .catch(() => {
        if (active) setFailed(true)
      })

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [photo.url])

  if (failed) {
    return (
      <div className="grid aspect-square place-items-center border border-zinc-200 bg-zinc-50 p-3 text-center text-xs text-zinc-500 dark:border-white/10 dark:bg-white/[0.03]">
        Photo {position} could not be loaded.
      </div>
    )
  }

  if (!source) {
    return (
      <div className="grid aspect-square place-items-center border border-zinc-200 bg-zinc-50 text-xs text-zinc-500 dark:border-white/10 dark:bg-white/[0.03]" role="status">
        Loading photo…
      </div>
    )
  }

  return (
    <a className="block focus:outline-none focus:ring-2 focus:ring-[#4C1268]" href={source} rel="noreferrer" target="_blank">
      <img
        alt={`Customer review photo ${position}`}
        className="aspect-square w-full border border-zinc-200 object-cover dark:border-white/10"
        height={photo.height}
        src={source}
        width={photo.width}
      />
    </a>
  )
}

export function ReviewPhotos({ photos }: { photos: SellerReviewPhoto[] }) {
  if (photos.length === 0) return null

  return (
    <div className="mt-5 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Customer review photos">
      {photos.map((photo, index) => (
        <PrivateReviewPhoto key={photo.id} photo={photo} position={index + 1} />
      ))}
    </div>
  )
}
