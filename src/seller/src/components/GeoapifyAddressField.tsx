import { useEffect, useId, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'

export type GeoapifyAddressKind = 'province' | 'municipality' | 'barangay'

export type GeoapifySuggestion = {
  id: string
  label: string
  value: string
  placeId: string | null
  city: string | null
  province: string | null
  region: string | null
  postcode: string | null
}

type GeoapifyProperties = {
  place_id?: string
  formatted?: string
  name?: string
  suburb?: string
  district?: string
  quarter?: string
  neighbourhood?: string
  city?: string
  municipality?: string
  county?: string
  state?: string
  postcode?: string
  country_code?: string
}

type GeoapifyResponse = {
  features?: Array<{ properties?: GeoapifyProperties }>
}

type Props = {
  apiKey: string
  boundaryPlaceId?: string | null
  context?: string
  error?: string
  id: string
  kind: GeoapifyAddressKind
  label: string
  name: string
  onChange: (value: string) => void
  onSelect: (suggestion: GeoapifySuggestion) => void
  required?: boolean
  value: string
}

const inputClass = 'h-11 w-full rounded-lg border border-zinc-300 bg-white px-3.5 text-sm text-zinc-950 outline-none placeholder:text-zinc-400 focus:border-[#E6007A] focus:ring-2 focus:ring-pink-500/15 dark:border-white/15 dark:bg-[#111113] dark:text-white dark:placeholder:text-zinc-600'

export function GeoapifyAddressField({ apiKey, boundaryPlaceId, context, error, id, kind, label, name, onChange, onSelect, required, value }: Props) {
  const listboxId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const selectedValueRef = useRef('')
  const [suggestions, setSuggestions] = useState<GeoapifySuggestion[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)
  const [isLoading, setIsLoading] = useState(false)
  const [lookupUnavailable, setLookupUnavailable] = useState(false)
  const [noSuggestions, setNoSuggestions] = useState(false)
  const [hasFocus, setHasFocus] = useState(false)
  const normalizedQuery = value.trim()
  const isOpen = hasFocus && (isLoading || suggestions.length > 0 || lookupUnavailable || noSuggestions)
  const errorId = error ? `${id}-error` : undefined
  const helpId = `${id}-help`

  useEffect(() => {
    setActiveIndex(-1)

    if (normalizedQuery === selectedValueRef.current) {
      setSuggestions([])
      setNoSuggestions(false)
      return
    }

    if (!apiKey || normalizedQuery.length < 2) {
      setSuggestions([])
      setIsLoading(false)
      setLookupUnavailable(!apiKey && normalizedQuery.length >= 2)
      setNoSuggestions(false)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setIsLoading(true)
      setLookupUnavailable(false)
      setNoSuggestions(false)

      const query = context ? `${normalizedQuery}, ${context}, Philippines` : `${normalizedQuery}, Philippines`
      const params = new URLSearchParams({
        apiKey,
        filter: boundaryPlaceId ? `place:${boundaryPlaceId}|countrycode:ph` : 'countrycode:ph',
        format: 'geojson',
        lang: 'en',
        limit: '8',
        text: query,
        type: kind === 'province' ? 'state' : kind === 'municipality' ? 'city' : 'locality',
      })

      try {
        const response = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?${params}`, { signal: controller.signal })
        if (!response.ok) throw new Error('Geoapify lookup failed')
        const payload = await response.json() as GeoapifyResponse
        const mapped = (payload.features ?? [])
          .map((feature) => toSuggestion(feature.properties, kind))
          .filter((suggestion): suggestion is GeoapifySuggestion => suggestion !== null)
          .filter((suggestion, index, all) => all.findIndex((candidate) => candidate.value.toLocaleLowerCase() === suggestion.value.toLocaleLowerCase()) === index)
        setSuggestions(mapped)
        setNoSuggestions(mapped.length === 0)
      } catch (caught) {
        if (!(caught instanceof DOMException && caught.name === 'AbortError')) {
          setSuggestions([])
          setLookupUnavailable(true)
          setNoSuggestions(false)
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }, 350)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [apiKey, boundaryPlaceId, context, kind, normalizedQuery])

  function choose(suggestion: GeoapifySuggestion) {
    selectedValueRef.current = suggestion.value.trim()
    onSelect(suggestion)
    setSuggestions([])
    setActiveIndex(-1)
    setLookupUnavailable(false)
    setNoSuggestions(false)
    setHasFocus(false)
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    selectedValueRef.current = ''
    onChange(event.target.value)
    setLookupUnavailable(false)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!suggestions.length) {
      if (event.key === 'Escape') setSuggestions([])
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((current) => current >= suggestions.length - 1 ? 0 : current + 1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((current) => current <= 0 ? suggestions.length - 1 : current - 1)
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault()
      choose(suggestions[activeIndex])
    } else if (event.key === 'Escape') {
      setSuggestions([])
      setActiveIndex(-1)
    }
  }

  return (
    <div ref={containerRef}>
      <label className="mb-1.5 block text-sm font-medium" htmlFor={id}>{label}</label>
      <div className="relative">
        <input
          aria-autocomplete="list"
          aria-controls={isOpen ? listboxId : undefined}
          aria-describedby={[helpId, errorId].filter(Boolean).join(' ')}
          aria-expanded={isOpen}
          aria-invalid={Boolean(error)}
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
          autoComplete="off"
          className={`${inputClass} ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/15' : ''}`}
          id={id}
          name={name}
          onBlur={(event) => {
            if (!containerRef.current?.contains(event.relatedTarget)) setHasFocus(false)
          }}
          onChange={handleChange}
          onFocus={() => setHasFocus(true)}
          onKeyDown={handleKeyDown}
          required={required}
          role="combobox"
          value={value}
        />
        {isOpen ? (
          <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-md dark:border-white/10 dark:bg-[#171719]" id={listboxId} role="listbox">
            {isLoading ? <p className="px-3 py-2 text-sm text-zinc-500" role="status">Loading suggestions…</p> : null}
            {!isLoading && suggestions.map((suggestion, index) => (
              <button
                aria-selected={activeIndex === index}
                className={`block w-full px-3 py-2 text-left text-sm ${activeIndex === index ? 'bg-pink-50 text-zinc-950 dark:bg-white/10 dark:text-white' : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-white/5'}`}
                id={`${listboxId}-${index}`}
                key={suggestion.id}
                onClick={() => choose(suggestion)}
                onMouseDown={(event) => event.preventDefault()}
                role="option"
                type="button"
              >
                {suggestion.label}
              </button>
            ))}
            {!isLoading && lookupUnavailable ? <p className="px-3 py-2 text-sm text-amber-700 dark:text-amber-300" role="status">Suggestions are unavailable. Continue by entering this field manually.</p> : null}
            {!isLoading && noSuggestions ? <p className="px-3 py-2 text-sm text-zinc-600 dark:text-zinc-300" role="status">No matching suggestion found. Continue by entering this field manually.</p> : null}
          </div>
        ) : null}
      </div>
      <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400" id={helpId}>Type at least 2 characters, then choose a suggestion or keep your manual entry.</p>
      {error ? <p className="mt-1.5 text-sm text-red-600 dark:text-red-400" id={errorId} role="alert">{error}</p> : null}
    </div>
  )
}

function toSuggestion(properties: GeoapifyProperties | undefined, kind: GeoapifyAddressKind): GeoapifySuggestion | null {
  if (!properties || properties.country_code?.toLocaleLowerCase() !== 'ph') return null

  const province = properties.county ?? properties.state ?? null
  const region = properties.county && properties.state && properties.county !== properties.state ? properties.state : null
  const city = properties.city ?? properties.municipality ?? null
  const value = kind === 'province'
    ? province ?? properties.name
    : kind === 'municipality'
      ? city ?? properties.name
      : properties.suburb ?? properties.district ?? properties.quarter ?? properties.neighbourhood ?? properties.name

  if (!value) return null

  return {
    id: properties.place_id ?? `${kind}-${value}-${properties.formatted ?? ''}`,
    label: properties.formatted ?? [value, city, province, properties.state, 'Philippines'].filter(Boolean).join(', '),
    value,
    placeId: properties.place_id ?? null,
    city,
    province,
    region,
    postcode: properties.postcode ?? null,
  }
}
