import { useEffect, useState } from 'react'
import { apiBlobRequest } from '../lib/api'

type Props = {
  initials: string
  photoUrl: string | null | undefined
  className?: string
}

export function SellerAvatar({ initials, photoUrl, className = 'size-9' }: Props) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    let createdUrl: string | null = null
    setObjectUrl(null)

    if (photoUrl) {
      apiBlobRequest(photoUrl)
        .then((blob) => {
          if (!active) return
          createdUrl = URL.createObjectURL(blob)
          setObjectUrl(createdUrl)
        })
        .catch(() => undefined)
    }

    return () => {
      active = false
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [photoUrl])

  return objectUrl
    ? <img alt="Seller profile" className={`${className} shrink-0 rounded-full object-cover`} src={objectUrl} />
    : <div aria-hidden="true" className={`${className} grid shrink-0 place-items-center rounded-full bg-purple-100 text-sm font-semibold uppercase text-[#4C1268] dark:bg-purple-400/15 dark:text-purple-200`}>{initials}</div>
}
