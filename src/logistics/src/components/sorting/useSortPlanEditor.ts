import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError, blob as requestBlob, csrf, request, requestWithTimeout } from '../../lib/api'
import type { SortingLane, SortingPlan, SortingPlansOverview } from '../../types/sorting'
import { COMPACT_PAGE_SIZE } from '../CompactPagination'

export function useSortPlanEditor() {
  const [overview, setOverview] = useState<SortingPlansOverview | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [newPlanName, setNewPlanName] = useState('')
  const [planName, setPlanName] = useState('')
  const [laneId, setLaneId] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [supportedCodes, setSupportedCodes] = useState<string[]>([])
  const [destinationType, setDestinationType] = useState<'postal_code' | 'hub'>('postal_code')
  const [destinationHubId, setDestinationHubId] = useState('')
  const helpDialog = useRef<HTMLDialogElement>(null)
  const [mappingPosition, setMappingPosition] = useState('1')
  const [editingLane, setEditingLane] = useState<SortingLane | null>(null)
  const [laneCode, setLaneCode] = useState('')
  const [laneName, setLaneName] = useState('')
  const [laneType, setLaneType] = useState<SortingLane['type']>('standard')
  const [lanePosition, setLanePosition] = useState('1')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [versionBlocked, setVersionBlocked] = useState(false)
  const [copyBlocked, setCopyBlocked] = useState(false)
  const [duplicatePlan, setDuplicatePlan] = useState<SortingPlan | null>(null)
  const workBlocked = versionBlocked || copyBlocked || duplicatePlan !== null
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const laneDialog = useRef<HTMLDialogElement>(null)
  const planDialog = useRef<HTMLDialogElement>(null)
  const [creatingPlan, setCreatingPlan] = useState(false)
  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const [mappingPage, setMappingPage] = useState(1)
  const [lanePage, setLanePage] = useState(1)

  function openPlanEditor(create: boolean) {
    setError('')
    setCreatingPlan(create)
    if (create) setNewPlanName('')
    else if (selectedPlan) { setPlanName(selectedPlan.name) }
    setWorkspaceOpen(true)
    planDialog.current?.showModal()
  }

  function selectPlan(id: string) {
    if (workBlocked) return
    setCreatingPlan(false)
    setSelectedPlanId(id)
    setError('')
    setNotice('')
  }

  async function deletePlan() {
    if (workBlocked || selectedPlan?.archived_at || !selectedPlan || !window.confirm('Delete ' + selectedPlan.name + ' and its mappings? ' + (selectedPlan.is_active ? 'Automatic sorting will use the exception lane until another plan is activated.' : 'Previous scan history is preserved.'))) return
    setBusy(true); setError(''); setNotice('')
    try {
      await csrf()
      await request('/api/v1/logistics/sorting/plans/' + selectedPlan.id, { method: 'DELETE', body: JSON.stringify({ expected_revision: selectedPlan.revision }) })
      setNotice('Sort plan deleted.')
      await load()
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : 'The plan could not be deleted.') }
    finally { setBusy(false) }
  }

  const selectedPlan = overview?.plans.find((plan) => plan.id === selectedPlanId) ?? null
  const activePlan = overview?.plans.find((plan) => plan.id === overview.active_plan_id) ?? null
  const standardLanes = useMemo(() => overview?.lanes.filter((lane) => lane.type === 'standard' && lane.is_active) ?? [], [overview?.lanes])
  const exceptionLanes = useMemo(() => overview?.lanes.filter((lane) => lane.type === 'exception' && lane.is_active) ?? [], [overview?.lanes])
  const orderedLanes = useMemo(() => [...(overview?.lanes ?? [])].sort((a, b) => a.position - b.position || a.code.localeCompare(b.code)), [overview?.lanes])
  const orderedMappings = useMemo(() => [...(selectedPlan?.lanes ?? [])].sort((a, b) => (a.lane?.position ?? 999) - (b.lane?.position ?? 999) || a.position - b.position), [selectedPlan?.lanes])
  const activeMappings = useMemo(() => [...(activePlan?.versions.find((version) => version.id === activePlan.active_version_id)?.mappings.map((mapping) => ({ ...mapping, lane: overview?.lanes.find((lane) => lane.id === mapping.sorting_lane_id) ?? null })) ?? [])].sort((a, b) => (a.lane?.position ?? 999) - (b.lane?.position ?? 999) || a.position - b.position), [activePlan, overview?.lanes])
  const unmappedCodes = useMemo(() => supportedCodes.filter((code) => !selectedPlan?.lanes.some((mapping) => mapping.postal_code === code)).sort(), [supportedCodes, selectedPlan?.lanes])
  const currentMappingPage = Math.min(mappingPage, Math.max(1, Math.ceil(activeMappings.length / COMPACT_PAGE_SIZE)))
  const currentLanePage = Math.min(lanePage, Math.max(1, Math.ceil(orderedLanes.length / COMPACT_PAGE_SIZE)))

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await requestWithTimeout<{ data: SortingPlansOverview }>('/api/v1/logistics/sorting/plans')
      setOverview(result.data)
      setSelectedPlanId((current) => result.data.plans.some((plan) => plan.id === current) ? current : (result.data.active_plan_id ?? result.data.plans[0]?.id ?? ''))
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Sort plans could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { document.title = 'Sort plan | Aisley Logistics'; void load() }, [load])
  useEffect(() => {
    if (!selectedPlan) return
    setPlanName(selectedPlan.name)
    setLaneId((current) => standardLanes.some((lane) => lane.id === current) ? current : (standardLanes[0]?.id ?? ''))
    setMappingPosition(String((selectedPlan.lanes.length || 0) + 1))
  }, [selectedPlan, standardLanes])

  async function createPlan(event: FormEvent) {
    event.preventDefault()
    setBusy(true); setError(''); setNotice('')
    try {
      await csrf()
      const result = await request<{ data: { id: string } }>('/api/v1/logistics/sorting/plans', { method: 'POST', body: JSON.stringify({ name: newPlanName, is_active: false }) })
      setSelectedPlanId(result.data.id)
      setNewPlanName('')
      setCreatingPlan(false)
      setNotice('Draft created. Add mappings, then publish a version.')
      await load()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The sort plan could not be created.')
    } finally { setBusy(false) }
  }

  async function savePlan() {
    if (workBlocked || selectedPlan?.archived_at || !selectedPlan) return
    setBusy(true); setError(''); setNotice('')
    try {
      await csrf()
      await request('/api/v1/logistics/sorting/plans/' + selectedPlan.id, {
        method: 'PATCH',
        body: JSON.stringify({ expected_revision: selectedPlan.revision, name: planName }),
      })
      setNotice('Draft updated. Publish a version to apply it to new scans.')
      await load()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The sort plan could not be updated.')
    } finally { setBusy(false) }
  }

  async function addMapping(event: FormEvent) {
    event.preventDefault()
    if (workBlocked || selectedPlan?.archived_at || !selectedPlan || !laneId) return
    setBusy(true); setError(''); setNotice('')
    try {
      await csrf()
      await request('/api/v1/logistics/sorting/plans/' + selectedPlan.id + '/lanes', {
        method: 'POST',
        body: JSON.stringify({ expected_revision: selectedPlan.revision, lane_id: laneId, destination_type: destinationType, ...(destinationType === 'hub' ? { destination_hub_id: destinationHubId } : { postal_code: postalCode }), position: Number(mappingPosition) }),
      })
      setPostalCode('')
      setDestinationHubId('')
      setNotice('Destination mapped to the sort plan.')
      await load()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The destination mapping could not be saved.')
    } finally { setBusy(false) }
  }

  async function removeMapping(mappingId: string, postal: string) {
    if (workBlocked || selectedPlan?.archived_at || !selectedPlan || !window.confirm('Remove destination ' + postal + ' from ' + selectedPlan.name + '?')) return
    setBusy(true); setError(''); setNotice('')
    try {
      await csrf()
      await request('/api/v1/logistics/sorting/plans/' + selectedPlan.id + '/lanes/' + mappingId, {
        method: 'DELETE',
        body: JSON.stringify({ expected_revision: selectedPlan.revision }),
      })
      setNotice('Destination mapping removed.')
      await load()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The destination mapping could not be removed.')
    } finally { setBusy(false) }
  }

  function openLaneEditor(lane?: SortingLane) {
    setEditingLane(lane ?? null)
    setLaneCode(lane?.code ?? '')
    setLaneName(lane?.name ?? '')
    setLaneType(lane?.type ?? 'standard')
    setLanePosition(String(lane?.position ?? ((overview?.lanes.length ?? 0) + 1)))
    laneDialog.current?.showModal()
  }

  async function saveLane(event: FormEvent) {
    event.preventDefault()
    setBusy(true); setError(''); setNotice('')
    try {
      await csrf()
      const body = { code: laneCode, name: laneName, type: laneType, position: Number(lanePosition), ...(editingLane ? { expected_revision: editingLane.revision } : {}) }
      await request(editingLane ? '/api/v1/logistics/sorting/lanes/' + editingLane.id : '/api/v1/logistics/sorting/lanes', {
        method: editingLane ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      })
      laneDialog.current?.close()
      setNotice(editingLane ? 'Sorting lane updated.' : 'Sorting lane created.')
      await load()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The sorting lane could not be saved.')
    } finally { setBusy(false) }
  }

  async function toggleLane(lane: SortingLane) {
    if (lane.is_active && !window.confirm('Deactivate ' + lane.code + '? Automatic routing will use the exception lane until it is active again.')) return
    setBusy(true); setError(''); setNotice('')
    try {
      await csrf()
      await request('/api/v1/logistics/sorting/lanes/' + lane.id, { method: 'PATCH', body: JSON.stringify({ expected_revision: lane.revision, is_active: !lane.is_active }) })
      setNotice(lane.is_active ? lane.code + ' deactivated.' : lane.code + ' activated.')
      await load()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The sorting lane could not be changed.')
    } finally { setBusy(false) }
  }

  async function openLabel(lane: SortingLane) {
    const popup = window.open('about:blank', '_blank')
    if (!popup) { setError('Allow pop-ups to open the printable lane label.'); return }
    popup.opener = null
    try {
      const asset = await requestBlob(lane.label_url)
      const objectUrl = URL.createObjectURL(asset)
      popup.location.href = objectUrl
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    } catch (caught) {
      popup.close()
      setError(caught instanceof ApiError ? caught.message : 'The lane label could not be opened.')
    }
  }

  return {
    workspaceOpen,
    setWorkspaceOpen,
    overview,
    selectedPlanId,
    setSelectedPlanId,
    newPlanName,
    setNewPlanName,
    planName,
    setPlanName,
    laneId,
    setLaneId,
    postalCode,
    setPostalCode,
    setSupportedCodes,
    destinationType,
    setDestinationType,
    destinationHubId,
    setDestinationHubId,
    helpDialog,
    mappingPosition,
    setMappingPosition,
    editingLane,
    laneCode,
    setLaneCode,
    laneName,
    setLaneName,
    laneType,
    setLaneType,
    lanePosition,
    setLanePosition,
    loading,
    busy,
    setVersionBlocked,
    setCopyBlocked,
    duplicatePlan,
    setDuplicatePlan,
    workBlocked,
    error,
    setError,
    notice,
    setNotice,
    laneDialog,
    planDialog,
    creatingPlan,
    setCreatingPlan,
    setMappingPage,
    setLanePage,
    selectedPlan,
    activePlan,
    standardLanes,
    exceptionLanes,
    orderedLanes,
    orderedMappings,
    activeMappings,
    unmappedCodes,
    currentMappingPage,
    currentLanePage,
    load,
    openPlanEditor,
    selectPlan,
    deletePlan,
    createPlan,
    savePlan,
    addMapping,
    removeMapping,
    openLaneEditor,
    saveLane,
    toggleLane,
    openLabel,
  }
}

export type SortPlanEditor = ReturnType<typeof useSortPlanEditor>
