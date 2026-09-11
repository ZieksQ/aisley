import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { FaLocationDot, FaPen, FaPlus, FaTrashCan, FaXmark } from 'react-icons/fa6'
import { ApiError } from '../lib/api'
import { fetchPsgcOptions, type PsgcAddressOption, type PsgcLevel } from '../lib/psgc-options'
import { createPickupAddress, deletePickupAddress, getPickupAddresses, pickupAddressSummary, updatePickupAddress } from '../lib/sellerPickupAddresses'
import type { PickupAddress, PickupAddressPayload } from '../types/pickupAddresses'
import { GeoapifyLocationPicker } from './GeoapifyLocationPicker'

type FormValues = {
  label: string; recipient_name: string; contact_number: string; address_line_1: string; address_line_2: string
  barangay: string; city_municipality: string; province: string; region: string; postal_code: string
  country: string; latitude: number | null; longitude: number | null; is_default: boolean
}

const blank: FormValues = {
  label: '', recipient_name: '', contact_number: '', address_line_1: '', address_line_2: '', barangay: '',
  city_municipality: '', province: '', region: '', postal_code: '', country: 'Philippines', latitude: null, longitude: null, is_default: false,
}
const locationFields = new Set<keyof FormValues>(['address_line_1', 'address_line_2', 'barangay', 'city_municipality', 'province', 'region', 'postal_code', 'country'])

function initial(address?: PickupAddress): FormValues {
  if (!address) return blank
  return {
    label: address.label ?? '', recipient_name: address.recipient_name, contact_number: address.contact_number,
    address_line_1: address.address_line_1, address_line_2: address.address_line_2 ?? '', barangay: address.barangay,
    city_municipality: address.city_municipality, province: address.province, region: address.region,
    postal_code: address.postal_code, country: address.country,
    latitude: address.latitude === null ? null : Number(address.latitude), longitude: address.longitude === null ? null : Number(address.longitude), is_default: address.is_default,
  }
}

export function PickupAddressBook() {
  const [addresses, setAddresses] = useState<PickupAddress[]>([])
  const [editing, setEditing] = useState<PickupAddress | 'new' | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    try { setAddresses((await getPickupAddresses(signal)).data) }
    catch (error) { if (!signal?.aborted) setMessage(error instanceof Error ? error.message : 'Pickup addresses could not be loaded.') }
    finally { if (!signal?.aborted) setLoading(false) }
  }, [])

  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort() }, [load])

  async function remove(address: PickupAddress) {
    if (!window.confirm(`Delete ${address.label || 'this pickup address'}? Existing waybills keep their saved address.`)) return
    setBusyId(address.id); setMessage('')
    try { await deletePickupAddress(address.id); await load(); setMessage('Pickup address deleted.') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'The pickup address could not be deleted.') }
    finally { setBusyId('') }
  }

  return <section aria-labelledby="pickup-address-heading" className="mt-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-[#18181b] sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="font-semibold" id="pickup-address-heading">Pickup addresses</h3><p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Save shop locations and choose a default for new pickup orders.</p></div>
      <button className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#4C1268] px-4 text-sm font-semibold text-white disabled:opacity-50" onClick={() => setEditing('new')} type="button"><FaPlus />Add address</button>
    </div>
    {message ? <p className="mt-4 text-sm text-zinc-700 dark:text-zinc-300" role="status">{message}</p> : null}
    {loading ? <p className="mt-5 text-sm text-zinc-500">Loading pickup addresses…</p> : addresses.length === 0 ? <p className="mt-5 border-l-2 border-[#FF8800] pl-3 text-sm text-zinc-600 dark:text-zinc-300">Add a pickup address before requesting courier pickup.</p> : <div className="mt-5 grid gap-3 md:grid-cols-2">
      {addresses.map((address) => <article className="border border-zinc-200 p-4 dark:border-white/10" key={address.id}>
        <div className="flex items-start gap-3"><FaLocationDot className="mt-1 shrink-0 text-[#4C1268] dark:text-purple-300" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><h4 className="font-medium">{address.label || 'Pickup address'}</h4>{address.is_default ? <span className="text-xs font-semibold text-[#9B0757] dark:text-pink-300">Default</span> : null}</div><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{address.recipient_name} · {address.contact_number}</p><p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{pickupAddressSummary(address)}</p><p className={`mt-1 text-xs ${address.latitude !== null && address.longitude !== null ? 'text-zinc-500' : 'text-amber-700 dark:text-amber-300'}`}>{address.latitude !== null && address.longitude !== null ? `Pin saved · ${Number(address.latitude).toFixed(6)}, ${Number(address.longitude).toFixed(6)}` : 'No exact map pin saved'}</p></div></div>
        <div className="mt-4 flex justify-end gap-2 border-t border-zinc-200 pt-3 dark:border-white/10"><button className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-sm font-semibold text-[#4C1268] hover:bg-purple-50 dark:text-purple-300 dark:hover:bg-white/5" onClick={() => setEditing(address)} type="button"><FaPen />Edit</button><button className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-400/10" disabled={busyId === address.id} onClick={() => void remove(address)} type="button"><FaTrashCan />{busyId === address.id ? 'Deleting…' : 'Delete'}</button></div>
      </article>)}
    </div>}
    {editing ? <PickupAddressForm address={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); setMessage('Pickup address saved.') }} /> : null}
  </section>
}

function PickupAddressForm({ address, onClose, onSaved }: { address?: PickupAddress; onClose: () => void; onSaved: () => Promise<void> }) {
  const [values, setValues] = useState(() => initial(address))
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [submitting, setSubmitting] = useState(false)
  const [options, setOptions] = useState<Record<PsgcLevel, PsgcAddressOption[]>>({ regions: [], provinces: [], municipalities: [], barangays: [] })
  const [optionsUnavailable, setOptionsUnavailable] = useState(false)

  const selectedRegion = useMemo(() => options.regions.find((item) => item.name === values.region), [options.regions, values.region])
  const selectedProvince = useMemo(() => options.provinces.find((item) => item.name === values.province), [options.provinces, values.province])
  const selectedMunicipality = useMemo(() => options.municipalities.find((item) => item.name === values.city_municipality), [options.municipalities, values.city_municipality])

  const fetchOptions = useCallback(async (level: PsgcLevel, filters: Record<string, string> = {}) => {
    try { const result = await fetchPsgcOptions(level, filters); setOptions((current) => ({ ...current, [level]: result })); setOptionsUnavailable(false) }
    catch { setOptionsUnavailable(true) }
  }, [])

  useEffect(() => { void fetchOptions('regions') }, [fetchOptions])
  useEffect(() => { if (selectedRegion) void fetchOptions('provinces', { reg: selectedRegion.code }) }, [fetchOptions, selectedRegion])
  useEffect(() => { if (selectedRegion) { const filters: Record<string, string> = { reg: selectedRegion.code }; if (selectedProvince) filters.prv = selectedProvince.code; void fetchOptions('municipalities', filters) } }, [fetchOptions, selectedProvince, selectedRegion])
  useEffect(() => { if (selectedRegion && selectedMunicipality) { const filters: Record<string, string> = { reg: selectedRegion.code, mun: selectedMunicipality.code }; if (selectedProvince) filters.prv = selectedProvince.code; void fetchOptions('barangays', filters) } }, [fetchOptions, selectedMunicipality, selectedProvince, selectedRegion])
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }; document.addEventListener('keydown', close); return () => document.removeEventListener('keydown', close) }, [onClose])

  function update(field: keyof FormValues, value: string | boolean) {
    setValues((current) => ({ ...current, [field]: value, ...(locationFields.has(field) ? { latitude: null, longitude: null } : {}), ...(field === 'region' ? { province: '', city_municipality: '', barangay: '' } : {}), ...(field === 'province' ? { city_municipality: '', barangay: '' } : {}), ...(field === 'city_municipality' ? { barangay: '' } : {}) }))
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setSubmitting(true); setErrors({})
    const payload: PickupAddressPayload = { ...values, label: values.label.trim() || null, address_line_2: values.address_line_2.trim() || null }
    try {
      if (address) await updatePickupAddress(address.id, payload)
      else await createPickupAddress(payload)
      await onSaved()
    }
    catch (error) { setErrors(error instanceof ApiError ? error.errors : { form: [error instanceof Error ? error.message : 'The pickup address could not be saved.'] }) }
    finally { setSubmitting(false) }
  }

  return <div aria-labelledby="pickup-address-dialog-title" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4" role="dialog" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}><form className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-zinc-200 bg-white p-5 shadow-lg dark:border-white/10 dark:bg-[#18181b] sm:p-6" onSubmit={submit}>
    <div className="flex items-start justify-between gap-4"><div><h3 className="text-lg font-semibold" id="pickup-address-dialog-title">{address ? 'Edit pickup address' : 'Add pickup address'}</h3><p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Use official PSGC fields, then pin the exact entrance couriers should use.</p></div><button aria-label="Close address form" className="grid size-9 shrink-0 place-items-center rounded-md hover:bg-zinc-100 dark:hover:bg-white/10" onClick={onClose} type="button"><FaXmark /></button></div>
    {errors.form?.[0] ? <p className="mt-4 text-sm text-red-700 dark:text-red-300" role="alert">{errors.form[0]}</p> : null}
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <AddressField error={errors.label?.[0]} label="Address label" name="label" onChange={(value) => update('label', value)} placeholder="Main shop or Warehouse" value={values.label} />
      <AddressField error={errors.recipient_name?.[0]} label="Contact person" name="recipient_name" onChange={(value) => update('recipient_name', value)} required value={values.recipient_name} />
      <AddressField error={errors.contact_number?.[0]} label="Contact number" name="contact_number" onChange={(value) => update('contact_number', value)} required value={values.contact_number} />
      <AddressField error={errors.address_line_1?.[0]} label="Street, building, or house number" name="address_line_1" onChange={(value) => update('address_line_1', value)} required value={values.address_line_1} />
      <AddressField error={errors.address_line_2?.[0]} label="Unit, floor, or landmark" name="address_line_2" onChange={(value) => update('address_line_2', value)} value={values.address_line_2} />
      <OptionField error={errors.region?.[0]} label="Region" list="pickup-regions" onChange={(value) => update('region', value)} options={options.regions} required value={values.region} />
      <OptionField error={errors.province?.[0]} label="Province" list="pickup-provinces" onChange={(value) => update('province', value)} options={options.provinces} required value={values.province} />
      <OptionField error={errors.city_municipality?.[0]} label="City or municipality" list="pickup-municipalities" onChange={(value) => update('city_municipality', value)} options={options.municipalities} required value={values.city_municipality} />
      <OptionField error={errors.barangay?.[0]} label="Barangay" list="pickup-barangays" onChange={(value) => update('barangay', value)} options={options.barangays} required value={values.barangay} />
      <AddressField error={errors.postal_code?.[0]} label="Postal code" name="postal_code" onChange={(value) => update('postal_code', value)} required value={values.postal_code} />
      <AddressField error={errors.country?.[0]} label="Country" name="country" onChange={(value) => update('country', value)} required value={values.country} />
    </div>
    {optionsUnavailable ? <p className="mt-4 border-l-2 border-[#FF8800] pl-3 text-xs text-zinc-600 dark:text-zinc-300" role="status">Official address options are temporarily unavailable. You can still enter the administrative address manually.</p> : <p className="mt-4 text-xs text-zinc-500">Type to search official PSA PSGC options in sequence.</p>}
    {import.meta.env.GEOAPIFY_API_KEY ? <div className="mt-5 border-t border-zinc-200 pt-5 dark:border-white/10"><GeoapifyLocationPicker address={{ addressLine1: values.address_line_1, barangay: values.barangay, cityMunicipality: values.city_municipality, province: values.province, region: values.region, postalCode: values.postal_code, country: values.country }} apiKey={import.meta.env.GEOAPIFY_API_KEY} latitude={values.latitude} longitude={values.longitude} onChange={({ latitude, longitude }) => setValues((current) => ({ ...current, latitude, longitude }))} /></div> : <div className="mt-5 flex gap-2 border-l-2 border-zinc-400 pl-3 text-xs leading-5 text-zinc-500"><FaLocationDot className="mt-0.5 shrink-0" />Geoapify location pinning is not configured. You can still save the textual address without coordinates.</div>}
    <label className="mt-5 flex items-start gap-3 text-sm"><input checked={values.is_default} className="mt-0.5 size-4 accent-[#E6007A]" onChange={(event) => update('is_default', event.target.checked)} type="checkbox" /><span><span className="font-medium">Use as default pickup address</span><span className="mt-1 block text-xs text-zinc-500">New pickup requests start with this address. You can choose another saved address for a request.</span></span></label>
    <div className="mt-6 flex justify-end gap-3 border-t border-zinc-200 pt-5 dark:border-white/10"><button className="min-h-10 rounded-lg border border-zinc-300 px-4 text-sm font-semibold dark:border-white/15" onClick={onClose} type="button">Cancel</button><button className="min-h-10 rounded-lg bg-[#4C1268] px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={submitting}>{submitting ? 'Saving…' : 'Save address'}</button></div>
  </form></div>
}

function AddressField({ error, label, name, onChange, placeholder, required, value }: { error?: string; label: string; name: string; onChange: (value: string) => void; placeholder?: string; required?: boolean; value: string }) {
  return <label className="text-sm font-medium">{label}{required ? ' *' : ''}<input aria-invalid={Boolean(error)} className="mt-1.5 min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-[#E6007A] focus:ring-2 focus:ring-pink-100 dark:border-white/15 dark:bg-[#111113] dark:focus:ring-pink-500/10" name={name} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} value={value} />{error ? <span className="mt-1 block text-xs text-red-700 dark:text-red-300">{error}</span> : null}</label>
}

function OptionField({ error, label, list, onChange, options, required, value }: { error?: string; label: string; list: string; onChange: (value: string) => void; options: PsgcAddressOption[]; required?: boolean; value: string }) {
  return <label className="text-sm font-medium">{label}{required ? ' *' : ''}<input aria-invalid={Boolean(error)} className="mt-1.5 min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-[#E6007A] focus:ring-2 focus:ring-pink-100 dark:border-white/15 dark:bg-[#111113] dark:focus:ring-pink-500/10" list={list} onChange={(event) => onChange(event.target.value)} required={required} type="search" value={value} /><datalist id={list}>{options.map((option) => <option key={option.code} value={option.name} />)}</datalist>{error ? <span className="mt-1 block text-xs text-red-700 dark:text-red-300">{error}</span> : null}</label>
}
