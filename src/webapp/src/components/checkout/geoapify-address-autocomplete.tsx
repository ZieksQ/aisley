"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FiMapPin } from "react-icons/fi";

export type GeoapifyAddressSelection = {
  addressLine1?: string;
  barangay?: string;
  cityMunicipality?: string;
  province?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  latitude: number;
  longitude: number;
};

type GeoapifyResult = {
  place_id?: string;
  result_type?: string;
  formatted?: string;
  name?: string;
  address_line1?: string;
  housenumber?: string;
  street?: string;
  suburb?: string;
  city?: string;
  municipality?: string;
  county?: string;
  state?: string;
  postcode?: string;
  country?: string;
  lat?: number;
  lon?: number;
};

type GeoapifyResponse = { results?: GeoapifyResult[] };

function coordinates(result: GeoapifyResult) {
  const { lat: latitude, lon: longitude } = result;

  return typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    typeof longitude === "number" &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180
    ? { latitude, longitude }
    : null;
}

function addressLine1(result: GeoapifyResult) {
  const streetAddress = [result.housenumber, result.street].filter(Boolean).join(" ");
  if (streetAddress) return streetAddress;

  // Geoapify can include an address_line1 value for broad place results such as
  // cities. Only copy that value into the street/building field when the result
  // is actually address-like; a city such as Manila belongs in the city field.
  if (["address", "amenity", "building", "street"].includes(result.result_type ?? "")) {
    return result.address_line1 ?? result.name;
  }

  return undefined;
}

function valueAtResultLevel(
  result: GeoapifyResult,
  level: "suburb" | "city" | "county" | "state",
  structuredValue?: string,
) {
  return structuredValue ?? (result.result_type === level ? result.name : undefined);
}

export function GeoapifyAddressAutocomplete({
  apiKey,
  onSelect,
}: {
  apiKey: string;
  onSelect: (selection: GeoapifyAddressSelection) => void;
}) {
  const listboxId = useId();
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedQuery = useRef<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoapifyResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    if (selectedQuery.current === query) return;

    const text = query.trim();
    if (text.length < 3) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setStatus("loading");
      const params = new URLSearchParams({
        text,
        apiKey,
        format: "json",
        filter: "countrycode:ph",
        lang: "en",
        limit: "6",
      });

      try {
        const response = await fetch(
          `https://api.geoapify.com/v1/geocode/autocomplete?${params.toString()}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Geoapify autocomplete failed");

        const payload = (await response.json()) as GeoapifyResponse;
        const nextResults = (payload.results ?? []).filter(
          (result) => Boolean(result.place_id && result.formatted) && coordinates(result) !== null,
        );
        setResults(nextResults);
        setActiveIndex(-1);
        setIsOpen(true);
        setStatus("ready");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setResults([]);
        setIsOpen(false);
        setStatus("error");
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [apiKey, query]);

  useEffect(
    () => () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    },
    [],
  );

  function select(result: GeoapifyResult) {
    const point = coordinates(result);
    if (!point) return;

    const formatted = result.formatted ?? result.name ?? "";
    selectedQuery.current = formatted;
    setQuery(formatted);
    setResults([]);
    setIsOpen(false);
    onSelect({
      addressLine1: addressLine1(result),
      barangay: valueAtResultLevel(result, "suburb", result.suburb),
      cityMunicipality: valueAtResultLevel(
        result,
        "city",
        result.city ?? result.municipality,
      ),
      province: valueAtResultLevel(result, "county", result.county),
      region: valueAtResultLevel(result, "state", result.state),
      postalCode: result.postcode,
      country: result.country,
      ...point,
    });
  }

  return (
    <div>
      <label htmlFor={`${listboxId}-input`} className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#31123F]">
        <FiMapPin aria-hidden="true" className="size-4" />
        Find your address
      </label>
      <div className="relative">
        <input
          id={`${listboxId}-input`}
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={isOpen && results.length > 0}
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
          autoComplete="off"
          value={query}
          onChange={(event) => {
            const nextQuery = event.target.value;
            selectedQuery.current = null;
            setQuery(nextQuery);
            setActiveIndex(-1);
            if (nextQuery.trim().length < 3) {
              setResults([]);
              setIsOpen(false);
              setStatus("idle");
            }
          }}
          onFocus={() => {
            if (blurTimer.current) clearTimeout(blurTimer.current);
            if (results.length > 0) setIsOpen(true);
          }}
          onBlur={() => {
            blurTimer.current = setTimeout(() => setIsOpen(false), 150);
          }}
          onKeyDown={(event) => {
            if (!isOpen || results.length === 0) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((current) => (current + 1) % results.length);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((current) => current <= 0 ? results.length - 1 : current - 1);
            } else if (event.key === "Enter" && activeIndex >= 0) {
              event.preventDefault();
              select(results[activeIndex]);
            } else if (event.key === "Escape") {
              setIsOpen(false);
            }
          }}
          placeholder="Search barangay, city, building, or street"
          className="min-h-12 w-full rounded-md border border-[#D9D3DE] bg-white px-3 text-[15px] text-[#2D2231] outline-none focus:border-[#4C1268] focus:ring-3 focus:ring-[#4C1268]/10"
        />

        {isOpen && results.length > 0 ? (
          <ul id={listboxId} role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-[#D9D3DE] bg-white py-1 shadow-[0_2px_8px_rgba(45,34,49,0.12)]">
            {results.map((result, index) => (
              <li
                id={`${listboxId}-${index}`}
                key={result.place_id}
                role="option"
                aria-selected={activeIndex === index}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => select(result)}
                className={`cursor-pointer px-3 py-2.5 text-sm leading-5 ${activeIndex === index ? "bg-[#F6F0F8] text-[#31123F]" : "text-[#514656]"}`}
              >
                {result.formatted}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs leading-5 text-[#746978]">
        <span aria-live="polite">
          {status === "loading"
            ? "Finding matching addresses…"
            : status === "error"
              ? "Address suggestions are unavailable. Enter the address manually below."
              : status === "ready" && results.length === 0
                ? "No matching address found. You can enter it manually below."
                : "Choose a suggestion, then review every address field and map pin."}
        </span>
        <span className="shrink-0">
          Powered by{" "}
          <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer" className="underline hover:text-[#4C1268]">Geoapify</a>
          {" · "}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline hover:text-[#4C1268]">© OpenStreetMap contributors</a>
        </span>
      </div>
    </div>
  );
}
