import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, csrf, requestWithTimeout } from '../../lib/api'
import type { Connection, NetworkOverview } from './types'

export function useNetwork(online: boolean) {
  const [overview, setOverview] = useState<NetworkOverview | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const version = useRef(0)
  const load = useCallback(async () => {
    const current = ++version.current
    if (!online) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await requestWithTimeout<{ data: NetworkOverview }>(
        `/api/v1/logistics/linehaul?${new URLSearchParams({ search, page: String(page) })}`
      )
      if (current === version.current) setOverview(result.data)
    } catch (caught) {
      if (current !== version.current) return
      if (caught instanceof ApiError && [401, 403].includes(caught.status))
        setOverview(null)
      setError(
        caught instanceof Error
          ? caught.message
          : 'Could not load your network.'
      )
    } finally {
      if (current === version.current) setLoading(false)
    }
  }, [online, search, page])
  useEffect(() => {
    void load()
    return () => {
      version.current++
    }
  }, [load])

  async function write(path: string, body: object) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await csrf()
      await requestWithTimeout(path, {
        method: 'PUT',
        body: JSON.stringify(body)
      })
      setNotice('Connection updated.')
      await load()
    } catch (caught) {
      if (caught instanceof ApiError && [401, 403].includes(caught.status))
        setOverview(null)
      setError(
        caught instanceof Error
          ? caught.message
          : 'Could not update this connection. Refresh and retry.'
      )
    } finally {
      setBusy(false)
    }
  }
  const incoming =
    overview?.incoming_connections.filter(
      (row) => row.sender_requested && !row.receiver_accepted
    ) ?? []
  // Connections are unpaginated; the discovery directory is paginated independently.
  const connected = new Map<
    string,
    { name: string; outgoing?: Connection; incoming?: Connection }
  >()
  for (const row of overview?.connections ?? []) {
    if (row.is_active && row.receiver_accepted)
      connected.set(row.to_hub_id, {
        name: row.to_hub?.name ?? 'Partner hub',
        outgoing: row
      })
  }
  for (const row of overview?.incoming_connections ?? []) {
    if (row.is_active && row.receiver_accepted)
      connected.set(row.from_hub_id, {
        ...connected.get(row.from_hub_id),
        name: row.from_hub?.name ?? 'Partner hub',
        incoming: row
      })
  }
  return {
    overview,
    search,
    setSearch,
    page,
    setPage,
    loading,
    busy,
    error,
    notice,
    incoming,
    connected,
    load,
    write
  }
}
