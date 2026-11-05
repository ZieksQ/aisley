import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../../lib/api'
import { createCampaign, emptyCampaign, getCampaign, previewCampaign, sendCampaign, updateCampaign } from '../../lib/notificationCampaigns'
import type { Campaign, CampaignInput, CampaignPreview } from '../../lib/notificationCampaigns'

function sameInput(a: CampaignInput, b: CampaignInput) {
  return a.title === b.title && a.body === b.body && a.audience_key === b.audience_key
    && a.destination_type === b.destination_type && a.destination_id === b.destination_id
}
function message(reason: unknown) {
  return reason instanceof Error ? reason.message : 'The request could not be completed.'
}
function editableInput(value: CampaignInput): CampaignInput {
  const { title, body, audience_key, destination_type, destination_id } = value
  return { title, body, audience_key, destination_type, destination_id }
}
const activeStatuses = ['preparing', 'queued', 'sending']

export function useCampaignEditor(id: string | undefined, canManage: boolean) {
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [input, setInput] = useState<CampaignInput>(emptyCampaign)
  const [preview, setPreview] = useState<CampaignPreview | null>(null)
  const [loading, setLoading] = useState(Boolean(id))
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState<{ operation: 'load' | 'save' | 'preview' | 'send'; message: string } | null>(null)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [notice, setNotice] = useState('')
  const [conflict, setConflict] = useState(false)
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const alive = useRef(false)
  const lock = useRef(false)
  const reads = useRef(0)
  const sendRequest = useRef<{ revision: number; key: string } | null>(null)
  const dirty = sameInput(input, campaign ?? emptyCampaign) === false

  useEffect(() => {
    alive.current = true
    const invalidate = () => { alive.current = false; reads.current++ }
    return invalidate
  }, [])

  const accessFailure = useCallback((reason: unknown) => {
    if (reason instanceof ApiError && [401, 403].includes(reason.status)) {
      setDenied(true)
      setCampaign(null)
      setInput(emptyCampaign)
      setPreview(null)
      setErrors({})
      sendRequest.current = null
    }
  }, [])

  const read = useCallback(async (initialize = false) => {
    if (!id) return null
    const sequence = ++reads.current
    const result = await getCampaign(id)
    if (!alive.current || sequence !== reads.current) return null
    setCampaign(result.data)
    setUpdatedAt(new Date().toISOString())
    setPreview(current => current?.revision === result.data.revision && result.data.status === 'draft' ? current : null)
    if (initialize) setInput(editableInput(result.data))
    return result.data
  }, [id])

  const refresh = useCallback(async () => {
    if (lock.current || !alive.current) return
    lock.current = true
    setRefreshing(true)
    try {
      const result = await read(!campaign)
      if (!alive.current || !result) return
      setUncertain(false)
      setError(null)
      setNotice(result.status === 'draft' && sendRequest.current
        ? 'Status checked: this campaign is still a draft. Review and retry the same send request.' : '')
    } catch (reason) {
      if (alive.current) { accessFailure(reason); setError({ operation: 'load', message: message(reason) }) }
    } finally {
      lock.current = false
      if (alive.current) { setRefreshing(false); setLoading(false) }
    }
  }, [read, accessFailure, campaign])

  useEffect(() => {
    let current = true
    setLoading(Boolean(id))
    if (id) void read(true).catch(reason => {
      if (current && alive.current) { accessFailure(reason); setError({ operation: 'load', message: message(reason) }) }
    }).finally(() => { if (current && alive.current) setLoading(false) })
    const invalidate = () => { current = false; reads.current++ }
    return invalidate
  }, [id, read, accessFailure])

  const activeStatus = campaign?.status
  useEffect(() => {
    if (!activeStatus || !activeStatuses.includes(activeStatus) || denied) return
    const timer = window.setInterval(() => { void refresh() }, 5000)
    return () => window.clearInterval(timer)
  }, [activeStatus, denied, refresh])

  function change(next: CampaignInput) {
    if (lock.current || uncertain || !canManage) return
    setInput(next)
    setPreview(null)
    setErrors({})
    setNotice('')
    if (error?.operation !== 'load') setError(null)
  }

  async function operate(operation: 'save' | 'preview' | 'send') {
    if (!canManage || denied || lock.current || uncertain || !alive.current) return
    if (campaign && campaign.status !== 'draft') return
    if (operation !== 'save' && (!campaign || dirty)) return
    if (operation === 'send' && (!preview?.dispatch_allowed || preview.revision !== campaign?.revision)) return
    lock.current = true
    reads.current++
    setBusy(true)
    setError(null)
    setErrors({})
    setNotice('')
    try {
      if (operation === 'save') {
        const result = campaign && id ? await updateCampaign(id, input, campaign.revision) : await createCampaign(input)
        if (!alive.current) return
        setCampaign(result.data)
        setInput(editableInput(result.data))
        setPreview(null)
        sendRequest.current = null
        setUpdatedAt(new Date().toISOString())
        setConflict(false)
        setNotice('Draft saved. Calculate the audience before sending.')
        if (!id) setCreatedId(result.data.id)
      } else if (operation === 'preview' && campaign && id) {
        setPreview(null)
        const result = await previewCampaign(id, campaign.revision)
        if (alive.current) setPreview(result.data)
      } else if (operation === 'send' && campaign && id) {
        if (sendRequest.current?.revision !== campaign.revision)
          sendRequest.current = { revision: campaign.revision, key: crypto.randomUUID() }
        const result = await sendCampaign(id, sendRequest.current.revision, sendRequest.current.key)
        if (!alive.current) return
        setCampaign(result.data)
        setPreview(null)
        setUpdatedAt(new Date().toISOString())
        setNotice('Campaign queued. Delivery results update from the server.')
      }
    } catch (reason) {
      if (!alive.current) return
      accessFailure(reason)
      setError({ operation, message: message(reason) })
      if (reason instanceof ApiError && operation === 'save') setErrors(reason.errors)
      if (operation === 'send') {
        setPreview(null)
        setUncertain(true)
        try {
          const result = await read()
          if (!alive.current || !result) return
          setUncertain(false)
          setNotice(result.status === 'draft'
            ? 'Status checked: still a draft. Calculate the audience again before retrying the same send request.'
            : 'The server has accepted this campaign. Check delivery results below.')
          if (result.status !== 'draft') setError(null)
        } catch (refreshError) {
          if (alive.current) accessFailure(refreshError)
        }
      } else if (reason instanceof ApiError && reason.status === 409) {
        setPreview(null)
        try {
          const result = await read()
          if (alive.current && result) {
            setConflict(true)
            setNotice('A newer version is available. Your text is retained; compare it with the saved message before saving again.')
          }
        } catch (refreshError) {
          if (alive.current) {
            accessFailure(refreshError)
            setError({ operation: 'load', message: 'Could not retrieve the latest revision. Check status before saving again.' })
          }
        }
      }
    } finally {
      lock.current = false
      if (alive.current) setBusy(false)
    }
  }

  return {
    campaign, input, preview, loading, busy, refreshing, uncertain, denied, error, errors,
    notice, conflict, createdId, updatedAt, dirty, change, refresh, save: () => operate('save'), calculate: () => operate('preview'), send: () => operate('send')
  }
}
