import { useEffect, useId, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'

export type GeoapifySuggestion = {
  id: string
  label: string
  barangay: string | null
  municipality: string | null
  province: string | null
  region: string | null
  postcode: string | null
}

type GeoapifyProperties = {
  place_id?: string
  name?: string
  suburb?: string
  district?: string
  quarter?: string
  neighbourhood?: string
  village?: string
  town?: string
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
  onSelect: (suggestion: GeoapifySuggestion) => void
}

const inputClass = 'h-11 w-full rounded-lg border border-zinc-300 bg-white px-3.5 text-sm text-zinc-950 outline-none placeholder:text-zinc-400 focus:border-[#E6007A] focus:ring-2 focus:ring-pink-500/15 dark:border-white/15 dark:bg-[#111113] dark:text-white dark:placeholder:text-zinc-600'

export function GeoapifyAddressField({ apiKey, onSelect }: Props) {
  const listboxId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const selectedLabelRef = useRef('')
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<GeoapifySuggestion[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)
  const [isLoading, setIsLoading] = useState(false)
  const [lookupUnavailable, setLookupUnavailable] = useState(false)
  const [noSuggestions, setNoSuggestions] = useState(false)
  const [hasFocus, setHasFocus] = useState(false)
  const normalizedQuery = query.trim()
  const isOpen = hasFocus && (isLoading || suggestions.length > 0 || lookupUnavailable || noSuggestions)
  const helpId = `${listboxId}-help`

  useEffect(() => {
    setActiveIndex(-1)

    if (normalizedQuery === selectedLabelRef.current) {
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

      const params = new URLSearchParams({
        apiKey,
        filter: 'countrycode:ph',
        format: 'geojson',
        lang: 'en',
        limit: '8',
        text: `${normalizedQuery}, Philippines`,
        type: 'locality',
      })

      try {
        const response = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?${params}`, { signal: controller.signal })
        if (!response.ok) throw new Error('Geoapify lookup failed')
        const payload = await response.json() as GeoapifyResponse
        const mapped = (payload.features ?? [])
          .map((feature) => toSuggestion(feature.properties))
          .filter((suggestion): suggestion is GeoapifySuggestion => suggestion !== null)
          .filter((suggestion, index, all) => all.findIndex((candidate) => candidate.label.toLocaleLowerCase() === suggestion.label.toLocaleLowerCase()) === index)
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
  }, [apiKey, normalizedQuery])

  function choose(suggestion: GeoapifySuggestion) {
    selectedLabelRef.current = suggestion.label
    setQuery(suggestion.label)
    onSelect(suggestion)
    setSuggestions([])
    setActiveIndex(-1)
    setLookupUnavailable(false)
    setNoSuggestions(false)
    setHasFocus(false)
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    selectedLabelRef.current = ''
    setQuery(event.target.value)
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
      <label className="mb-1.5 block text-sm font-medium" htmlFor="administrative_address_lookup">Find Province, Municipality, Barangay</label>
      <div className="relative">
        <input
          aria-autocomplete="list"
          aria-controls={isOpen ? listboxId : undefined}
          aria-describedby={helpId}
          aria-expanded={isOpen}
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
          autoComplete="off"
          className={inputClass}
          id="administrative_address_lookup"
          onBlur={(event) => {
            if (!containerRef.current?.contains(event.relatedTarget)) setHasFocus(false)
          }}
          onChange={handleChange}
          onFocus={() => setHasFocus(true)}
          onKeyDown={handleKeyDown}
          placeholder="Start typing a province, municipality, or barangay"
          role="combobox"
          value={query}
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
            {!isLoading && lookupUnavailable ? <p className="px-3 py-2 text-sm text-amber-700 dark:text-amber-300" role="status">Suggestions are unavailable. Enter the address manually below.</p> : null}
            {!isLoading && noSuggestions ? <p className="px-3 py-2 text-sm text-zinc-600 dark:text-zinc-300" role="status">No matching suggestion found. Enter the address manually below.</p> : null}
          </div>
        ) : null}
      </div>
      <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400" id={helpId}>Optional. Selecting a result copies its administrative address into the editable fields below.</p>
    </div>
  )
}

function toSuggestion(properties: GeoapifyProperties | undefined): GeoapifySuggestion | null {
  if (!properties || properties.country_code?.toLocaleLowerCase() !== 'ph') return null

  const municipality = properties.city ?? properties.municipality ?? properties.town ?? properties.village ?? null
  const province = properties.county ?? properties.state ?? null
  const region = properties.county && properties.state && properties.county !== properties.state ? properties.state : null
  const namedLocality = properties.name && !samePlace(properties.name, municipality) && !samePlace(properties.name, province) ? properties.name : null
  const barangay = properties.suburb ?? properties.district ?? properties.quarter ?? properties.neighbourhood ?? namedLocality
  const parts = [province, municipality, barangay].filter((part): part is string => Boolean(part))

  if (parts.length === 0) return null

  return {
    id: properties.place_id ?? parts.join('-'),
    label: parts.join(', '),
    barangay,
    municipality,
    province,
    region,
    postcode: properties.postcode ?? null,
  }
}

function samePlace(left: string, right: string | null): boolean {
  return right !== null && left.toLocaleLowerCase() === right.toLocaleLowerCase()
}
