import { useParcelQueue } from './useParcelQueue'
import { canUseOffline } from './readFallback'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ApiError } from '../../lib/api'
import {
  decodeParcelBarcode,
  normalizeParcelReference,
  type DecodedParcelBarcode,
} from '../../lib/parcelBarcode'
import { cacheParcels, findCachedParcel } from '../../lib/parcelSearchDb'
import type { FulfillmentShipment } from '../../types/fulfillment'
import { commitParcelTransition, fetchParcelRecord } from './api'
import { human, referenceFor, transitionLabels } from './presentation'

// Mounted per authenticated account/hub by the page. Request generations discard superseded reads.
export function useParcelSearch(context: string) {
  const [params, setParams] = useSearchParams()
  const urlReference = params.get('reference') ?? ''
  const queueModel = useParcelQueue(context)
  const { loadQueue, setQueueNotice } = queueModel
  const [reference, setReference] = useState(urlReference)
  const [record, setRecord] = useState<FulfillmentShipment | null>(null)
  const [recordSource, setRecordSource] = useState<
    'authoritative' | 'offline-cache' | null
  >(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [notice, setNotice] = useState('')
  const [reason, setReason] = useState('')
  const [evidenceChoice, setEvidenceChoice] = useState<Record<string, string>>(
    {},
  )
  const [transitionBusy, setTransitionBusy] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const [decodedParcel, setDecodedParcel] =
    useState<DecodedParcelBarcode | null>(null)
  const detailGeneration = useRef(0)
  const mounted = useRef(true)
  const mutationLock = useRef(false)
  const handledReference = useRef<string | null>(null)
  const recordReference = useRef('')
  const lastLookup = useRef(urlReference)
  const mutationAttempt = useRef<{ body: string; key: string } | null>(null)
  const [uncertain, setUncertain] = useState(false)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      detailGeneration.current++
    }
  }, [])
  const loadRecord = useCallback(
    async (value: string, decoded?: DecodedParcelBarcode) => {
      if (mutationLock.current || mutationAttempt.current) return
      const generation = ++detailGeneration.current
      const current = () =>
        mounted.current && generation === detailGeneration.current
      const decodedValue = decoded ?? decodeParcelBarcode(value)
      const nextReference =
        decodedValue.reference ?? normalizeParcelReference(value)
      lastLookup.current = nextReference
      setRecord(null)
      setRecordSource(null)
      setReason('')
      setEvidenceChoice({})
      setNotice('')
      setDecodedParcel(
        decoded || decodedValue.format !== 'reference' ? decodedValue : null,
      )
      setDetailError('')
      setDetailLoading(false)
      if (!nextReference) {
        setDetailError(
          'Enter a tracking ID, waybill, Order, Parcel, or shipment reference.',
        )
        return
      }
      setReference(nextReference)
      setDetailLoading(true)
      // Store intent in the URL immediately so history follows the selected parcel, including failed reads.
      handledReference.current = nextReference
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          next.set('reference', nextReference)
          return next
        },
        { replace: true },
      )
      try {
        if (!navigator.onLine) throw new ApiError(0, { message: 'Offline' })
        const result = await fetchParcelRecord(nextReference)
        if (!current()) return
        recordReference.current = nextReference
        setRecord(result.data)
        setRecordSource('authoritative')
        void cacheParcels(context, [result.data], true).catch(() => undefined)
      } catch (error) {
        if (!current()) return
        const cached = canUseOffline(error)
          ? await findCachedParcel(context, nextReference).catch(() => null)
          : null
        if (!current()) return
        if (cached) {
          recordReference.current = nextReference
          setRecord(cached.record)
          setRecordSource('offline-cache')
          setNotice(
            'Cached parcel details. Confirm current custody online before acting.',
          )
        } else
          setDetailError(
            error instanceof ApiError && error.status !== 0
              ? error.message
              : 'No cached details are available for this reference. Connect and try again.',
          )
      } finally {
        if (current()) setDetailLoading(false)
      }
    },
    [context, setParams],
  )

  useEffect(() => {
    document.title = 'Parcel search | Aisley Logistics'
  }, [])
  useEffect(() => {
    // A previous navigation's passive effect must not restart a superseded lookup.
    if (
      urlReference !==
      (new URLSearchParams(window.location.search).get('reference') ?? '')
    )
      return
    if (
      urlReference === handledReference.current ||
      mutationLock.current ||
      mutationAttempt.current
    )
      return
    handledReference.current = urlReference
    if (urlReference) void loadRecord(urlReference)
    else {
      detailGeneration.current++
      setRecord(null)
      setRecordSource(null)
      setReference('')
      setDetailLoading(false)
      setDetailError('')
      setDecodedParcel(null)
      setReason('')
      setEvidenceChoice({})
      setNotice('')
    }
  }, [urlReference, loadRecord])
  useEffect(() => {
    const onOnline = () => {
      setOnline(true)
      void loadQueue()
    }
    const onOffline = () => {
      setOnline(false)
      setQueueNotice(
        'Offline: parcel search is limited to records cached on this device.',
      )
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [loadQueue, setQueueNotice])

  function handleScan(raw: string) {
    const decoded = decodeParcelBarcode(raw)
    void loadRecord(raw, decoded)
  }
  function openRecord(item: FulfillmentShipment) {
    if (!mutationLock.current && !mutationAttempt.current)
      void loadRecord(referenceFor(item) || item.shipment_id)
  }

  async function submitTransition() {
    const attempt = mutationAttempt.current
    if (!attempt || mutationLock.current || !navigator.onLine) return
    mutationLock.current = true
    setTransitionBusy(true)
    setDetailError('')
    setNotice('')
    try {
      const result = await commitParcelTransition(attempt.body, attempt.key)
      if (!mounted.current) return
      mutationAttempt.current = null
      setUncertain(false)
      setRecord(result.data)
      setReason('')
      setEvidenceChoice({})
      setNotice('Custody update confirmed. Showing the current server record.')
      void cacheParcels(context, [result.data], true).catch(() => undefined)
      await loadQueue()
    } catch (error) {
      if (!mounted.current) return
      const unknown =
        !(error instanceof ApiError) ||
        error.status === 0 ||
        error.status === 408 ||
        error.status >= 500
      setUncertain(unknown)
      if (!unknown) mutationAttempt.current = null
      if (error instanceof ApiError && [401, 403].includes(error.status)) {
        setRecord(null)
        setRecordSource(null)
        setReason('')
        setEvidenceChoice({})
      }
      setDetailError(
        error instanceof Error
          ? error.message
          : 'The custody update could not be confirmed.',
      )
      if (error instanceof ApiError && error.status === 409) {
        mutationLock.current = false
        await loadRecord(recordReference.current)
        setDetailError(
          'The record changed. Review the latest server state before trying again.',
        )
      }
    } finally {
      mutationLock.current = false
      if (mounted.current) setTransitionBusy(false)
    }
  }
  async function transition(target: string, evidenceId?: string) {
    if (
      !record ||
      recordSource !== 'authoritative' ||
      !navigator.onLine ||
      detailLoading ||
      mutationLock.current ||
      mutationAttempt.current
    )
      return
    if (
      !window.confirm(
        `${transitionLabels[target] ?? human(target)} for ${recordReference.current}? The server will validate the current state and evidence.`,
      )
    )
      return
    mutationAttempt.current = {
      body: JSON.stringify({
        reference: recordReference.current,
        target_state: target,
        expected_revision: record.revision,
        evidence_id: evidenceId,
        reason: reason.trim() || undefined,
      }),
      key: crypto.randomUUID(),
    }
    await submitTransition()
  }
  const finalTask = useMemo(
    () => record?.tasks.find((task) => task.leg === 'final_mile') ?? null,
    [record],
  )
  const lookupBlocked = transitionBusy || uncertain
  return {
    ...queueModel,
    reference,
    setReference,
    record,
    recordSource,
    detailLoading,
    detailError,
    setDetailError,
    notice,
    reason,
    setReason,
    evidenceChoice,
    setEvidenceChoice,
    transitionBusy,
    scannerOpen,
    setScannerOpen,
    online,
    decodedParcel,
    loadRecord,
    handleScan,
    openRecord,
    finalTask,
    transition,
    lookupBlocked,
    uncertain,
    submitTransition,
    retryLookup: () => loadRecord(lastLookup.current),
    actionsEnabled:
      recordSource === 'authoritative' &&
      online &&
      !detailLoading &&
      !lookupBlocked,
  }
}
