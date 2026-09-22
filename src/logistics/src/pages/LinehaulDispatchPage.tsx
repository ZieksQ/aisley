import { useEffect } from 'react'
import { LinehaulDispatch } from '../components/LinehaulDispatch'

export function LinehaulDispatchPage() {
  useEffect(() => { document.title = 'Linehaul dispatch | Aisley Logistics' }, [])

  return <LinehaulDispatch />
}
