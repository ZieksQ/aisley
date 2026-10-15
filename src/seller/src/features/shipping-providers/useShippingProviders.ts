import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../auth/useAuth'
import { ApiError } from '../../lib/api'
import {
  getSellerLogisticsOptions,
  type LogisticsOption,
} from '../../lib/sellerLogisticsOptions'
import { getPickupAddresses } from '../../lib/sellerPickupAddresses'
import {
  getShippingProviders,
  updateShippingProvider,
  type ShippingProviderSetting,
} from '../../lib/sellerShippingProviders'
import { useOrderAccessError } from '../../lib/useSellerOrders'
import type { PickupAddress } from '../../types/pickupAddresses'

export type ProviderRow = ShippingProviderSetting & {
  ranking: LogisticsOption | null
  local: boolean
}
const same = (a: string | null | undefined, b: string | null | undefined) =>
  typeof a === 'string' &&
  typeof b === 'string' &&
  Boolean(a.trim() && b.trim()) &&
  a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase()

export function useShippingProviders() {
  const { seller } = useAuth()
  const accessError = useOrderAccessError()
  const [providers, setProviders] = useState<ShippingProviderSetting[]>([])
  const [ranked, setRanked] = useState<LogisticsOption[]>([])
  const [pickup, setPickup] = useState<PickupAddress | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [rankingNote, setRankingNote] = useState('')
  const controller = useRef<AbortController | null>(null)
  const writeController = useRef<AbortController | null>(null)
  const mutation = useRef(false)
  const generation = useRef(0)

  const load = useCallback(
    async (force = false) => {
      controller.current?.abort()
      const current = new AbortController()
      controller.current = current
      if (!seller) {
        setProviders([])
        setRanked([])
        setPickup(null)
        setLoading(false)
        return
      }
      setLoading(true)
      setError('')
      const [settings, options, addresses] = await Promise.allSettled([
        getShippingProviders(current.signal),
        getSellerLogisticsOptions(seller.id, force),
        getPickupAddresses(current.signal),
      ])
      if (current.signal.aborted) return
      if (settings.status === 'rejected') {
        if (accessError(settings.reason)) {
          setProviders([])
          setRanked([])
          setPickup(null)
        } else
          setError(
            settings.reason instanceof ApiError
              ? settings.reason.message
              : 'Shipping providers could not be loaded.',
          )
      } else {
        setProviders(settings.value.data)
        setRanked(options.status === 'fulfilled' ? options.value.data : [])
        const origin =
          addresses.status === 'fulfilled'
            ? (addresses.value.data.find((address) => address.is_default) ??
              null)
            : null
        setPickup(origin)
        setRankingNote(
          options.status === 'rejected'
            ? 'Location ranking is unavailable. You can still add providers. Check your default pickup address in Account settings and refresh.'
            : addresses.status === 'rejected'
              ? 'Your pickup address could not be loaded. Refresh to check which providers share your city and region.'
              : !origin?.city_municipality?.trim() || !origin.region?.trim()
                ? 'Add a complete default pickup address in Account settings to identify providers in your city and region.'
                : '',
        )
      }
      setLoading(false)
    },
    [seller, accessError],
  )

  useEffect(() => {
    generation.current += 1
    setSaving('')
    void load()
    return () => {
      generation.current += 1
      controller.current?.abort()
      writeController.current?.abort()
    }
  }, [load])

  const rows = useMemo<ProviderRow[]>(() => {
    const options = new Map(
      ranked.map((item, index) => [item.id, { item, index }]),
    )
    return providers
      .map((provider) => {
        const ranking = options.get(provider.organization_id)?.item ?? null
        const local = Boolean(
          pickup &&
          ranking &&
          same(pickup.city_municipality, ranking.hub.area.city_municipality) &&
          same(pickup.region, ranking.hub.area.region),
        )
        return { ...provider, ranking, local }
      })
      .sort(
        (a, b) =>
          Number(b.local) - Number(a.local) ||
          (options.get(a.organization_id)?.index ?? Number.MAX_SAFE_INTEGER) -
            (options.get(b.organization_id)?.index ??
              Number.MAX_SAFE_INTEGER) ||
          a.business_name.localeCompare(b.business_name),
      )
  }, [providers, ranked, pickup])

  async function save(provider: ProviderRow, enabled: boolean) {
    if (mutation.current || loading) return false
    mutation.current = true
    setSaving(provider.organization_id)
    setError('')
    setNotice('')
    const lifecycle = generation.current
    const write = new AbortController()
    writeController.current = write
    try {
      const response = await updateShippingProvider(
        provider,
        enabled,
        write.signal,
      )
      if (lifecycle !== generation.current) return false
      setProviders((items) =>
        items.map((item) =>
          item.organization_id === provider.organization_id
            ? {
                ...item,
                is_enabled: response.data.is_enabled,
                revision: response.data.revision,
              }
            : item,
        ),
      )
      setNotice(
        `${provider.business_name} ${enabled ? 'added. Customers can select this provider for new Orders.' : 'removed from new checkout choices. Existing Orders keep their selected provider.'}`,
      )
      return true
    } catch (reason) {
      if (lifecycle !== generation.current) return false
      if (accessError(reason)) {
        setProviders([])
        setRanked([])
        setPickup(null)
      } else if (reason instanceof ApiError && reason.status === 409) {
        await load(true)
        setError(
          'This provider setting changed elsewhere. Review the refreshed list before trying again.',
        )
      } else
        setError(
          reason instanceof ApiError
            ? reason.message
            : 'The update was not confirmed. Refresh providers to check the latest setting before trying again.',
        )
      return false
    } finally {
      mutation.current = false
      if (lifecycle === generation.current) setSaving('')
    }
  }
  return {
    rows,
    loading,
    saving,
    error,
    notice,
    rankingNote,
    pickup,
    load,
    save,
  }
}
