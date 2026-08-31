import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { apiRequest } from '../lib/api'
import { FormField, SelectField } from './FormField'

type AddressOption = {
  code: string
  name: string
}

type OptionsResponse = {
  options: AddressOption[]
}

type Props = {
  errors: Record<string, string[]>
}

const independentProvince: AddressOption = { code: '__independent__', name: 'Not applicable / independent city' }

export function PsgcAddressFields({ errors }: Props) {
  const [manual, setManual] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [regions, setRegions] = useState<AddressOption[]>([])
  const [provinces, setProvinces] = useState<AddressOption[]>([])
  const [municipalities, setMunicipalities] = useState<AddressOption[]>([])
  const [barangays, setBarangays] = useState<AddressOption[]>([])
  const [region, setRegion] = useState<AddressOption | null>(null)
  const [province, setProvince] = useState<AddressOption | null>(null)
  const [municipality, setMunicipality] = useState<AddressOption | null>(null)
  const [barangay, setBarangay] = useState<AddressOption | null>(null)
  const [loading, setLoading] = useState<'regions' | 'provinces' | 'municipalities' | 'barangays' | null>('regions')
  const requestSequence = useRef(0)

  useEffect(() => {
    const controller = new AbortController()
    apiRequest<OptionsResponse>('/api/v1/seller/auth/address-options/regions', { signal: controller.signal })
      .then((response) => setRegions(response.options))
      .catch(() => {
        if (!controller.signal.aborted) activateManualFallback()
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(null)
      })

    return () => controller.abort()
  }, [])

  function activateManualFallback() {
    requestSequence.current += 1
    setManual(true)
    setLoading(null)
    setNotice('Address options are unavailable. Enter the administrative address manually to continue.')
  }

  async function loadOptions(level: 'provinces' | 'municipalities' | 'barangays', query: URLSearchParams) {
    const sequence = ++requestSequence.current
    setLoading(level)
    setNotice(null)

    try {
      const response = await apiRequest<OptionsResponse>(`/api/v1/seller/auth/address-options/${level}?${query}`)
      if (sequence !== requestSequence.current) return null
      return response.options
    } catch {
      if (sequence === requestSequence.current) activateManualFallback()
      return null
    } finally {
      if (sequence === requestSequence.current) setLoading(null)
    }
  }

  async function changeRegion(event: ChangeEvent<HTMLSelectElement>) {
    const next = regions.find((option) => option.code === event.target.value) ?? null
    setRegion(next)
    setProvince(null)
    setMunicipality(null)
    setBarangay(null)
    setProvinces([])
    setMunicipalities([])
    setBarangays([])
    if (!next) return

    const options = await loadOptions('provinces', new URLSearchParams({ reg: next.code }))
    if (options) setProvinces([...options, independentProvince])
  }

  async function changeProvince(event: ChangeEvent<HTMLSelectElement>) {
    const next = provinces.find((option) => option.code === event.target.value) ?? null
    setProvince(next)
    setMunicipality(null)
    setBarangay(null)
    setMunicipalities([])
    setBarangays([])
    if (!region || !next) return

    const query = new URLSearchParams({ reg: region.code })
    if (next.code !== independentProvince.code) query.set('prv', next.code)
    const options = await loadOptions('municipalities', query)
    if (options) setMunicipalities(options)
  }

  async function changeMunicipality(event: ChangeEvent<HTMLSelectElement>) {
    const next = municipalities.find((option) => option.code === event.target.value) ?? null
    setMunicipality(next)
    setBarangay(null)
    setBarangays([])
    if (!region || !province || !next) return

    const query = new URLSearchParams({ reg: region.code, mun: next.code })
    if (province.code !== independentProvince.code) query.set('prv', province.code)
    const options = await loadOptions('barangays', query)
    if (options) setBarangays(options)
  }

  if (manual) {
    return (
      <>
        {notice ? <p className="sm:col-span-2 text-sm text-amber-700 dark:text-amber-300" role="status">{notice}</p> : null}
        <FormField defaultValue={region?.name ?? ''} error={errors['address.region']?.[0]} id="region" label="Region *" name="address[region]" required />
        <FormField defaultValue={province?.name === independentProvince.name ? '' : province?.name ?? ''} error={errors['address.province']?.[0]} id="province" label="Province *" name="address[province]" required />
        <FormField error={errors['address.postal_code']?.[0]} id="postal_code" label="Postal code *" maxLength={10} name="address[postal_code]" required />
        <FormField defaultValue={municipality?.name ?? ''} error={errors['address.city_municipality']?.[0]} id="city_municipality" label="City or municipality *" name="address[city_municipality]" required />
        <FormField defaultValue={barangay?.name ?? ''} error={errors['address.barangay']?.[0]} id="barangay" label="Barangay *" name="address[barangay]" required />
        <button className="self-end justify-self-start text-sm font-semibold text-[#b0005d] hover:underline dark:text-pink-400" onClick={() => { setManual(false); setNotice(null) }} type="button">
          Use address dropdowns
        </button>
        <ManualAddressLines errors={errors} />
      </>
    )
  }

  return (
    <>
      <SelectField disabled={loading === 'regions'} error={errors['address.region']?.[0]} id="region_select" label="Region *" onChange={changeRegion} required value={region?.code ?? ''}>
        <option disabled value="">{loading === 'regions' ? 'Loading regions…' : 'Select a region'}</option>
        {regions.map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}
      </SelectField>
      <SelectField disabled={!region || loading === 'provinces'} error={errors['address.province']?.[0]} id="province_select" label="Province *" onChange={changeProvince} required value={province?.code ?? ''}>
        <option disabled value="">{loading === 'provinces' ? 'Loading provinces…' : 'Select a province'}</option>
        {provinces.map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}
      </SelectField>
      <FormField error={errors['address.postal_code']?.[0]} id="postal_code" label="Postal code *" maxLength={10} name="address[postal_code]" required />
      <SelectField disabled={!province || loading === 'municipalities'} error={errors['address.city_municipality']?.[0]} id="municipality_select" label="City or municipality *" onChange={changeMunicipality} required value={municipality?.code ?? ''}>
        <option disabled value="">{loading === 'municipalities' ? 'Loading cities and municipalities…' : 'Select a city or municipality'}</option>
        {municipalities.map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}
      </SelectField>
      <SelectField disabled={!municipality || loading === 'barangays'} error={errors['address.barangay']?.[0]} id="barangay_select" label="Barangay *" onChange={(event) => setBarangay(barangays.find((option) => option.code === event.target.value) ?? null)} required value={barangay?.code ?? ''}>
        <option disabled value="">{loading === 'barangays' ? 'Loading barangays…' : 'Select a barangay'}</option>
        {barangays.map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}
      </SelectField>
      <button className="self-end justify-self-start text-sm font-semibold text-[#b0005d] hover:underline dark:text-pink-400" onClick={() => setManual(true)} type="button">
        Enter administrative address manually
      </button>
      <input name="address[region]" type="hidden" value={region?.name ?? ''} />
      <input name="address[province]" type="hidden" value={province?.name ?? ''} />
      <input name="address[city_municipality]" type="hidden" value={municipality?.name ?? ''} />
      <input name="address[barangay]" type="hidden" value={barangay?.name ?? ''} />
      <ManualAddressLines errors={errors} />
    </>
  )
}

function ManualAddressLines({ errors }: Props) {
  return (
    <>
      <p className="border-t border-zinc-200 pt-4 text-sm font-semibold dark:border-white/10 sm:col-span-2">Street address</p>
      <FormField error={errors['address.address_line_1']?.[0]} id="address_line_1" label="Street and house/building number *" name="address[address_line_1]" required />
      <FormField error={errors['address.address_line_2']?.[0]} id="address_line_2" label="Unit, floor, or landmark (optional)" name="address[address_line_2]" />
      <FormField disabled id="country" label="Country" name="country_display" value="Philippines" />
    </>
  )
}
