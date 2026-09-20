import { Button, TextField } from '@aisley/ui'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, request, requestBlob } from './lib/api'
import type { CourierAccount, AccountResponse } from './types'

type Kind = 'official_receipt' | 'certificate_of_registration'
interface Vehicle {
  id: string
  vehicle_type: 'motorcycle' | 'car' | 'van'
  plate_number: string
  make: string | null
  model: string | null
  revision: number
  official_receipt: { id: string; url: string } | null
  certificate_of_registration: { id: string; url: string } | null
}

function fileError(file: File): string | null {
  if (!/\.(jpe?g|png|webp)$/i.test(file.name) || file.name.split('.').length !== 2 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Choose a JPEG, PNG, or WebP image with one extension.'
  if (file.size >= 10 * 1024 * 1024) return 'Choose an image smaller than 10 MB.'
  return null
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.status === 409 ? `${error.message} Refresh before retrying.` : error.message
  return error instanceof Error ? error.message : 'Request failed. Check connectivity and retry.'
}

function PrivateImage({ path, token, label }: { path: string; token: string; label: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    let objectUrl: string | null = null
    void requestBlob(path, token).then((blob) => {
      const next = URL.createObjectURL(blob)
      objectUrl = next
      if (active) setUrl(next)
      else URL.revokeObjectURL(next)
    }).catch((caught) => { if (active) setError(errorMessage(caught)) })
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [path, token])
  return error ? <p role="alert">{error}</p> : url ? <img alt={label} className="private-image" src={url} /> : <p>Loading {label.toLowerCase()}…</p>
}

export function AccountExtras({ token, account, onAccountChange }: { token: string; account: CourierAccount; onAccountChange: (account: CourierAccount) => void }) {
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [form, setForm] = useState({ vehicle_type: 'motorcycle', plate_number: '', make: '', model: '' })
  const [photo, setPhoto] = useState<File | null>(null)
  const [document, setDocument] = useState<{ kind: Kind; file: File } | null>(null)
  const [preview, setPreview] = useState<'photo' | Kind | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const pendingMutation = useRef<{ signature: string; key: string } | null>(null)

  function mutationKey(signature: string): string {
    if (pendingMutation.current?.signature !== signature) pendingMutation.current = { signature, key: crypto.randomUUID() }
    return pendingMutation.current.key
  }

  const loadVehicle = useCallback(async () => {
    setError(null)
    try {
      const response = await request<{ data: Vehicle }>('/api/v1/courier/vehicle', {}, token)
      setVehicle(response.data)
      setForm({ vehicle_type: response.data.vehicle_type, plate_number: response.data.plate_number, make: response.data.make ?? '', model: response.data.model ?? '' })
    } catch (caught) { setError(errorMessage(caught)) }
  }, [token])
  useEffect(() => { void loadVehicle() }, [loadVehicle])

  async function saveVehicle() {
    if (!vehicle) return
    setBusy('vehicle'); setError(null); setNotice(null)
    try {
      const payload = { expected_revision: vehicle.revision, vehicle_type: form.vehicle_type, plate_number: form.plate_number, make: form.make || null, model: form.model || null }
      const response = await request<{ data: Vehicle }>('/api/v1/courier/vehicle', {
        method: 'PATCH', headers: { 'Idempotency-Key': mutationKey(`vehicle:${JSON.stringify(payload)}`) },
        body: JSON.stringify(payload),
      }, token)
      pendingMutation.current = null
      setVehicle(response.data)
      setNotice('Vehicle saved. Associated Logistics has been notified of the change.')
    } catch (caught) { setError(errorMessage(caught)) }
    finally { setBusy(null) }
  }

  async function uploadDocument() {
    if (!vehicle || !document) return
    const invalid = fileError(document.file)
    if (invalid) { setError(invalid); return }
    setBusy('document'); setError(null); setNotice(null)
    const body = new FormData()
    body.append('file', document.file)
    body.append('expected_revision', String(vehicle.revision))
    try {
      const signature = `document:${document.kind}:${vehicle.revision}:${document.file.name}:${document.file.size}:${document.file.lastModified}`
      const response = await request<{ data: Vehicle }>(`/api/v1/courier/vehicle/documents/${document.kind}`, { method: 'POST', headers: { 'Idempotency-Key': mutationKey(signature) }, body }, token)
      pendingMutation.current = null
      setVehicle(response.data)
      setDocument(null)
      setPreview(null)
      setNotice('Vehicle document saved. Associated Logistics has been notified of the change.')
    } catch (caught) { setError(errorMessage(caught)) }
    finally { setBusy(null) }
  }

  async function uploadPhoto() {
    if (!photo) return
    const invalid = fileError(photo)
    if (invalid) { setError(invalid); return }
    setBusy('photo'); setError(null); setNotice(null)
    const body = new FormData()
    body.append('photo', photo)
    try {
      const response = await request<AccountResponse>('/api/v1/courier/account/profile-photo', { method: 'POST', body }, token)
      onAccountChange(response.account)
      setPhoto(null)
      setPreview(null)
      setNotice('Profile photo saved.')
    } catch (caught) { setError(errorMessage(caught)) }
    finally { setBusy(null) }
  }

  async function removePhoto() {
    setBusy('photo'); setError(null); setNotice(null)
    try {
      const response = await request<AccountResponse>('/api/v1/courier/account/profile-photo', { method: 'DELETE' }, token)
      onAccountChange(response.account)
      setPreview(null)
      setNotice('Profile photo removed.')
    } catch (caught) { setError(errorMessage(caught)) }
    finally { setBusy(null) }
  }

  return <div className="forms-grid">
    <section className="panel" aria-labelledby="photo-heading">
      <div className="panel-header"><h2 id="photo-heading">Profile photo</h2></div>
      {error ? <p className="error-message" role="alert">{error}</p> : null}
      {notice ? <p className="notice" role="status">{notice}</p> : null}
      <p className="panel-description">JPEG, PNG, or WebP under 10 MB. The server checks the image before saving it.</p>
      {account.profile.profile_photo_url ? <Button className="min-h-10 rounded-md px-4 shadow-none" onClick={() => setPreview(preview === 'photo' ? null : 'photo')} variant="outline">{preview === 'photo' ? 'Hide photo' : 'View private photo'}</Button> : <p>No photo saved.</p>}
      {preview === 'photo' && account.profile.profile_photo_url ? <PrivateImage key={account.profile.profile_photo_url} label="Your profile photo" path="/api/v1/courier/account/profile-photo" token={token} /> : null}
      <input accept=".jpg,.jpeg,.png,.webp" aria-label="Choose profile photo" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} type="file" />
      <div className="form-actions"><Button className="min-h-10 rounded-md px-4 shadow-none" disabled={!photo || !!busy} onClick={() => void uploadPhoto()} variant="secondary">{busy === 'photo' ? 'Saving…' : 'Upload photo'}</Button>
        {account.profile.profile_photo_url ? <Button className="min-h-10 rounded-md px-4 shadow-none" disabled={!!busy} onClick={() => void removePhoto()} variant="outline">Remove photo</Button> : null}</div>
    </section>
    <section className="panel" aria-labelledby="vehicle-heading">
      <div className="panel-header"><h2 id="vehicle-heading">My vehicle</h2><Button className="min-h-10 rounded-md px-4 shadow-none" onClick={() => void loadVehicle()} variant="outline">Refresh</Button></div>
      {vehicle ? <div className="stack">
        <p className="status-line">Revision {vehicle.revision}</p>
        <label htmlFor="vehicle-type">Vehicle type</label>
        <select id="vehicle-type" onChange={(event) => setForm((current) => ({ ...current, vehicle_type: event.target.value }))} value={form.vehicle_type}><option value="motorcycle">Motorcycle</option><option value="car">Car</option><option value="van">Van</option></select>
        <TextField id="vehicle-plate" label="Plate number" onChange={(event) => setForm((current) => ({ ...current, plate_number: event.target.value }))} value={form.plate_number} />
        <TextField id="vehicle-make" label="Make (optional)" onChange={(event) => setForm((current) => ({ ...current, make: event.target.value }))} value={form.make} />
        <TextField id="vehicle-model" label="Model (optional)" onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))} value={form.model} />
        <Button className="min-h-10 rounded-md px-4 shadow-none" disabled={!!busy || !form.plate_number.trim()} onClick={() => void saveVehicle()} variant="secondary">{busy === 'vehicle' ? 'Saving…' : 'Save vehicle'}</Button>
        {(['official_receipt', 'certificate_of_registration'] as const).map((kind) => <div className="vehicle-document" key={kind}>
          <strong>{kind === 'official_receipt' ? 'Official receipt' : 'Certificate of registration'}</strong>
          <span>{vehicle[kind] ? 'Saved' : 'Missing'}</span>
          {vehicle[kind] ? <Button className="min-h-10 rounded-md px-4 shadow-none" onClick={() => setPreview(preview === kind ? null : kind)} variant="outline">{preview === kind ? 'Hide' : 'View privately'}</Button> : null}
          {preview === kind && vehicle[kind] ? <PrivateImage key={vehicle[kind].id} label={kind.replaceAll('_', ' ')} path={`/api/v1/courier/vehicle/documents/${kind}`} token={token} /> : null}
          <input accept=".jpg,.jpeg,.png,.webp" aria-label={`Choose ${kind.replaceAll('_', ' ')} image`} onChange={(event) => { const file = event.target.files?.[0]; setDocument(file ? { kind, file } : null) }} type="file" />
          <Button className="min-h-10 rounded-md px-4 shadow-none" disabled={document?.kind !== kind || !!busy} onClick={() => void uploadDocument()} variant="outline">{busy === 'document' && document?.kind === kind ? 'Saving…' : `Upload ${kind === 'official_receipt' ? 'OR' : 'CR'}`}</Button>
        </div>)}
      </div> : <p>Vehicle details unavailable. Refresh to retry.</p>}
    </section>
  </div>
}
