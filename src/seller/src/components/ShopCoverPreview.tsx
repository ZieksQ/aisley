import { useEffect, useState } from 'react'
import { apiBlobRequest } from '../lib/api'

type Props = {
  coverUrl: string | null
  file: File | null
}

export function ShopCoverPreview({ coverUrl, file }: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    let active = true
    let objectUrl: string | null = null
    setImageUrl(null)
    setUnavailable(false)

    const image = file ? Promise.resolve(file) : coverUrl ? apiBlobRequest(coverUrl) : null
    if (image) {
      image.then((blob) => {
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setImageUrl(objectUrl)
      }).catch(() => {
        if (active) setUnavailable(true)
      })
    }

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [coverUrl, file])

  return (
    <div aria-label="Shop cover preview" className="relative aspect-[16/5] min-h-28 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
      {imageUrl ? <img alt="Shop cover preview" className="absolute inset-0 size-full object-cover" src={imageUrl} /> : (
        <div className="grid size-full min-h-28 place-items-center text-sm text-zinc-500 dark:text-zinc-400">{unavailable ? 'Cover preview unavailable. Try again or choose a replacement.' : file || coverUrl ? 'Loading cover preview…' : 'No cover photo added'}</div>
      )}
    </div>
  )
}
