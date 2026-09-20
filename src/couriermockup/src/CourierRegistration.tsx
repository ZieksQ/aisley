import { Button, TextField } from '@aisley/ui'
import { useEffect, useState, type FormEvent } from 'react'
import { ApiError, request } from './lib/api'
import { barangays, municipalities, provinces, regionTree, regions, type Option } from './psgc'

type Field = 'first_name' | 'middle_name' | 'last_name' | 'contact_number' | 'sex' | 'birth_date' | 'email' | 'password' | 'password_confirmation' | 'plate_number' | 'address_line_1' | 'address_line_2' | 'postal_code' | 'province' | 'city_municipality' | 'barangay'
const initial: Record<Field, string> = { first_name: '', middle_name: '', last_name: '', contact_number: '', sex: '', birth_date: '', email: '', password: '', password_confirmation: '', plate_number: '', address_line_1: '', address_line_2: '', postal_code: '', province: '', city_municipality: '', barangay: '' }

function imageError(file: File | null): string | null {
  if (!file) return 'Select a required image.'
  if (!/\.(jpe?g|png|webp)$/i.test(file.name) || file.name.split('.').length !== 2 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Use a JPEG, PNG, or WebP image with one extension.'
  if (file.size >= 10 * 1024 * 1024) return 'Each image must be smaller than 10 MB.'
  return null
}

function SelectField({ id, label, options, value, onChange, disabled = false }: { id: string; label: string; options: Option[]; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return <label className="registration-select" htmlFor={id}>{label}<select disabled={disabled} id={id} onChange={(event) => onChange(event.target.value)} required value={value}>
    <option value="">Select {label.toLowerCase()}</option>{options.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
  </select></label>
}

export function CourierRegistration() {
  const [fields, setFields] = useState(initial)
  const [organizations, setOrganizations] = useState<Option[]>([])
  const [organization, setOrganization] = useState('')
  const [region, setRegion] = useState('')
  const [province, setProvince] = useState('')
  const [city, setCity] = useState('')
  const [barangay, setBarangay] = useState('')
  const [provinceOptions, setProvinceOptions] = useState<Option[]>([])
  const [cityOptions, setCityOptions] = useState<Option[]>([])
  const [barangayOptions, setBarangayOptions] = useState<Option[]>([])
  const [vehicleType, setVehicleType] = useState('motorcycle')
  const [governmentId, setGovernmentId] = useState<File | null>(null)
  const [registration, setRegistration] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    void request<{ data: Array<{ id: string; business_name: string }> }>('/api/v1/courier/auth/logistics-options')
      .then((response) => setOrganizations(response.data.map((item) => ({ code: item.id, name: item.business_name }))))
      .catch(() => setError('Could not load Logistics organizations. Reload and retry.'))
  }, [])

  async function chooseRegion(code: string) {
    setRegion(code); setProvince(''); setCity(''); setBarangay(''); setProvinceOptions([]); setCityOptions([]); setBarangayOptions([])
    if (!code) return
    try { setProvinceOptions(provinces(await regionTree(code))) }
    catch { setError('Address options are unavailable. Enter the province and other fields manually.') }
  }

  async function chooseProvince(code: string) {
    setProvince(code); setCity(''); setBarangay(''); setCityOptions([]); setBarangayOptions([])
    if (!region) return
    try { setCityOptions(municipalities(await regionTree(region), code)) }
    catch { setError('City options are unavailable. Reload and retry.') }
  }

  async function chooseCity(code: string) {
    setCity(code); setBarangay(''); setBarangayOptions([])
    if (!region || !code) return
    try { setBarangayOptions(barangays(await regionTree(region), province, code)) }
    catch { setError('Barangay options are unavailable. Reload and retry.') }
  }

  function setField(field: Field, value: string) { setFields((current) => ({ ...current, [field]: value })) }
  function name(options: Option[], code: string): string { return options.find((option) => option.code === code)?.name ?? '' }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const invalid = imageError(governmentId) ?? imageError(registration)
    if (invalid) { setError(invalid); return }
    if (!governmentId || !registration) return
    setBusy(true); setError(null); setNotice(null)
    const body = new FormData()
    for (const key of ['first_name', 'middle_name', 'last_name', 'contact_number', 'sex', 'birth_date', 'email', 'password', 'password_confirmation', 'plate_number'] as Field[]) body.append(key, fields[key])
    body.append('logistics_organization_id', organization)
    body.append('vehicle_type', vehicleType)
    const address = {
      address_line_1: fields.address_line_1, address_line_2: fields.address_line_2,
      barangay: name(barangayOptions, barangay) || fields.barangay, city_municipality: name(cityOptions, city) || fields.city_municipality,
      province: name(provinceOptions, province) || fields.province,
      region: name(regions, region), postal_code: fields.postal_code,
    }
    for (const [key, value] of Object.entries(address)) body.append(`address[${key}]`, value)
    body.append('government_id', governmentId)
    body.append('vehicle_registration', registration)
    try {
      const response = await request<{ message: string }>('/api/v1/courier/auth/register', { method: 'POST', body })
      setNotice(`${response.message} Wait for your selected Logistics organization to approve the account before signing in.`)
      setFields(initial); setGovernmentId(null); setRegistration(null)
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : 'Registration could not be submitted. Check connectivity and retry.') }
    finally { setBusy(false) }
  }

  return <section className="login-panel registration-panel" aria-labelledby="registration-heading">
    <h2 id="registration-heading">Courier registration</h2>
    <p className="panel-description">Registration creates a pending account. The current API accepts a combined OR/CR image; approved Couriers can replace OR and CR separately later.</p>
    {error ? <p className="error-message" role="alert">{error}</p> : null}
    {notice ? <p className="notice" role="status">{notice}</p> : null}
    <form className="stack" onSubmit={(event) => void submit(event)}>
      <div className="form-grid">
        {([['first_name', 'First name'], ['middle_name', 'Middle initial'], ['last_name', 'Last name'], ['contact_number', 'Contact number'], ['email', 'Email'], ['birth_date', 'Birth date'], ['password', 'Password'], ['password_confirmation', 'Confirm password']] as [Field, string][]).map(([key, label]) => <TextField id={`register-${key}`} key={key} label={label} onChange={(event) => setField(key, event.target.value)} required={key !== 'middle_name'} type={key === 'email' ? 'email' : key === 'birth_date' ? 'date' : key.includes('password') ? 'password' : 'text'} value={fields[key]} />)}
        <label className="registration-select" htmlFor="register-sex">Sex<select id="register-sex" onChange={(event) => setField('sex', event.target.value)} required value={fields.sex}><option value="">Select sex</option><option value="male">Male</option><option value="female">Female</option><option value="non_binary">Non-binary</option><option value="prefer_not_to_say">Prefer not to say</option></select></label>
        <SelectField id="register-logistics" label="Logistics organization" onChange={setOrganization} options={organizations} value={organization} />
        <SelectField id="register-region" label="Region" onChange={(value) => void chooseRegion(value)} options={regions} value={region} />
        {provinceOptions.length ? <SelectField id="register-province" label="Province" onChange={(value) => void chooseProvince(value)} options={provinceOptions} value={province} /> : <TextField id="register-province-manual" label="Province or district" onChange={(event) => { setField('province', event.target.value); if (region) void chooseProvince('') }} required value={fields.province} />}
        {cityOptions.length ? <SelectField disabled={!region || !!provinceOptions.length && !province} id="register-city" label="City or municipality" onChange={(value) => void chooseCity(value)} options={cityOptions} value={city} /> : <TextField id="register-city-manual" label="City or municipality" onChange={(event) => setField('city_municipality', event.target.value)} required value={fields.city_municipality} />}
        {barangayOptions.length ? <SelectField disabled={!city} id="register-barangay" label="Barangay" onChange={setBarangay} options={barangayOptions} value={barangay} /> : <TextField id="register-barangay-manual" label="Barangay" onChange={(event) => setField('barangay', event.target.value)} required value={fields.barangay} />}
        {([['address_line_1', 'Street and house number'], ['address_line_2', 'Address line 2 (optional)'], ['postal_code', 'Postal code'], ['plate_number', 'Plate number']] as [Field, string][]).map(([key, label]) => <TextField id={`register-${key}`} key={key} label={label} onChange={(event) => setField(key, event.target.value)} required={key !== 'address_line_2'} value={fields[key]} />)}
        <label className="registration-select" htmlFor="register-vehicle">Vehicle type<select id="register-vehicle" onChange={(event) => setVehicleType(event.target.value)} value={vehicleType}><option value="motorcycle">Motorcycle</option><option value="car">Car</option><option value="van">Van</option></select></label>
      </div>
      <p className="panel-description">Images: JPEG, PNG, or WebP, each under 10 MB.</p>
      <label>Government ID or driver’s license<input accept=".jpg,.jpeg,.png,.webp" onChange={(event) => setGovernmentId(event.target.files?.[0] ?? null)} required type="file" /></label>
      <label>Combined OR/CR vehicle registration image<input accept=".jpg,.jpeg,.png,.webp" onChange={(event) => setRegistration(event.target.files?.[0] ?? null)} required type="file" /></label>
      <Button className="min-h-11 rounded-md px-4 shadow-none" disabled={busy} type="submit" variant="secondary">{busy ? 'Submitting…' : 'Submit registration'}</Button>
    </form>
  </section>
}
