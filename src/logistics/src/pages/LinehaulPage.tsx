import { useEffect, useState } from 'react'
import { Linehaul } from '../components/Linehaul'

export function LinehaulPage() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    document.title = 'Linehaul | Aisley Logistics'
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])
  return <div className="space-y-3"><Linehaul online={online} /></div>
}
