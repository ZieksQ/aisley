import { useEffect, useState } from 'react'
import { NetworkWorkspace } from '../features/network/NetworkWorkspace'

export function LinehaulPage() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    document.title = 'Network | Aisley Logistics'
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])
  return <NetworkWorkspace online={online} />
}
