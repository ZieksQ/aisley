import { useEffect, useState } from 'react'
import { ApiError } from './api'
import { useOrderAccessError } from './useSellerOrders'
import { openWaybillPdf as openPdf } from './waybillPdf'

export const pickingSheetLimit = 50

type Selection = { scope: string; active: boolean; ids: Set<string> }

export function useOrderPickingSheet(scope: string) {
  const empty = (): Selection => ({ scope, active: false, ids: new Set() })
  const [stored, setStored] = useState<Selection>(empty)
  const selection = stored.scope === scope ? stored : empty()
  const [printing, setPrinting] = useState(false)
  const [failure, setFailure] = useState({ scope, message: '' })
  const accessError = useOrderAccessError()

  useEffect(() => {
    setStored({ scope, active: false, ids: new Set() })
    setFailure({ scope, message: '' })
  }, [scope])

  function toggle(ids: string[]) {
    if (printing) return
    setFailure({ scope, message: '' })
    setStored((current) => {
      const next = new Set(current.scope === scope ? current.ids : [])
      if (ids.every((id) => next.has(id))) ids.forEach((id) => next.delete(id))
      else ids.forEach((id) => next.add(id))
      if (next.size > pickingSheetLimit) return current
      return { scope, active: true, ids: next }
    })
  }

  function setActive(active: boolean) {
    if (printing) return
    setStored({ ...empty(), active })
    setFailure({ scope, message: '' })
  }

  async function print() {
    if (printing || !selection.ids.size) return
    setPrinting(true)
    setFailure({ scope, message: '' })
    const query = new URLSearchParams()
    selection.ids.forEach((id) => query.append('order_ids[]', id))
    try {
      await openPdf(`/api/v1/seller/orders/picking-sheet.pdf?${query}`, 'print', 'order-picking-sheet.pdf')
    } catch (error) {
      if (!accessError(error)) {
        setFailure({ scope, message: error instanceof ApiError ? error.message
          : 'Unable to open the picking sheet. Allow pop-ups for this site, check your connection, and try again.' })
      }
    } finally {
      setPrinting(false)
    }
  }

  return {
    active: selection.active,
    selectedIds: selection.ids,
    printing,
    error: failure.scope === scope ? failure.message : '',
    toggle,
    setActive,
    print,
  }
}

export type OrderPickingSelection = ReturnType<typeof useOrderPickingSheet>
