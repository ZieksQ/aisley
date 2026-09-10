import { useEffect, useState } from 'react'
import { blob } from '../lib/api'

type Props = { initials: string; photoUrl: string | null | undefined; className?: string }

export function LogisticsAvatar({ initials, photoUrl, className = 'size-20' }: Props) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    let createdUrl: string | null = null
    setObjectUrl(null)

    if (photoUrl) {
      blob(photoUrl).then((value) => {
        if (!active) return
        createdUrl = URL.createObjectURL(value)
        setObjectUrl(createdUrl)
      }).catch(() => undefined)
    }

    return () => {
      active = false
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [photoUrl])

  return objectUrl
    ? <img alt="Logistics profile" className={`${className} shrink-0 rounded-full object-cover`} src={objectUrl} />
    : <div aria-hidden="true" className={`${className} grid shrink-0 place-items-center rounded-full bg-purple-50 text-lg font-semibold uppercase text-[#4C1268] dark:bg-purple-200/15 dark:text-purple-100`}>{initials}</div>
}
