"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FiMapPin } from "react-icons/fi";

export type MapboxAddressSelection = {
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

type MapboxContextItem = {
  name?: string;
  address_number?: string;
  street_name?: string;
};

type MapboxFeature = {
  id?: string;
  geometry?: { coordinates?: [number, number] };
  properties?: {
    mapbox_id?: string;
    feature_type?: string;
    full_address?: string;
    name?: string;
    place_formatted?: string;
    coordinates?: { longitude?: number; latitude?: number };
    context?: {
      address?: MapboxContextItem;
      neighborhood?: MapboxContextItem;
      locality?: MapboxContextItem;
      place?: MapboxContextItem;
      district?: MapboxContextItem;
      region?: MapboxContextItem;
      postcode?: MapboxContextItem;
      country?: MapboxContextItem;
    };
  };
};

type MapboxResponse = { features?: MapboxFeature[] };

function coordinates(feature: MapboxFeature) {
  const longitude =
    feature.properties?.coordinates?.longitude ?? feature.geometry?.coordinates?.[0];
  const latitude =
    feature.properties?.coordinates?.latitude ?? feature.geometry?.coordinates?.[1];

  return typeof longitude === "number" && typeof latitude === "number"
    ? { longitude, latitude }
    : null;
}

function addressLine1(feature: MapboxFeature) {
  const address = feature.properties?.context?.address;
  if (address) {
    return [address.address_number, address.street_name ?? address.name]
      .filter(Boolean)
      .join(" ");
  }

  return ["address", "street"].includes(feature.properties?.feature_type ?? "")
    ? feature.properties?.name
    : undefined;
}

export function MapboxAddressAutocomplete({
  accessToken,
  onSelect,
}: {
  accessToken: string;
  onSelect: (selection: MapboxAddressSelection) => void;
}) {
  const listboxId = useId();
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedQuery = useRef<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MapboxFeature[]>([]);
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
        q: text,
        access_token: accessToken,
        autocomplete: "true",
        permanent: "true",
        country: "ph",
        language: "en",
        limit: "6",
        types: "address,street,neighborhood,locality,place,postcode",
      });

      try {
        const response = await fetch(
          `https://api.mapbox.com/search/geocode/v6/forward?${params.toString()}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Mapbox geocoding failed");

        const payload = (await response.json()) as MapboxResponse;
        const nextResults = (payload.features ?? []).filter(
          (feature) =>
            Boolean(feature.properties?.mapbox_id ?? feature.id) &&
            Boolean(feature.properties?.full_address ?? feature.properties?.name) &&
            coordinates(feature) !== null,
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
  }, [accessToken, query]);

  useEffect(
    () => () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    },
    [],
  );

  function select(feature: MapboxFeature) {
    const point = coordinates(feature);
    if (!point) return;

    const properties = feature.properties;
    const context = properties?.context;
    const formatted = properties?.full_address ??
      [properties?.name, properties?.place_formatted].filter(Boolean).join(", ");

    selectedQuery.current = formatted;
    setQuery(formatted);
    setResults([]);
    setIsOpen(false);
    onSelect({
      addressLine1: addressLine1(feature),
      barangay: context?.neighborhood?.name ?? context?.locality?.name,
      cityMunicipality:
        context?.place?.name ?? context?.locality?.name ?? context?.district?.name,
      province: context?.district?.name ?? context?.region?.name,
      region: context?.region?.name,
      postalCode: context?.postcode?.name,
      country: context?.country?.name,
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
            {results.map((feature, index) => {
              const properties = feature.properties;
              return (
                <li
                  id={`${listboxId}-${index}`}
                  key={properties?.mapbox_id ?? feature.id}
                  role="option"
                  aria-selected={activeIndex === index}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => select(feature)}
                  className={`cursor-pointer px-3 py-2.5 text-sm leading-5 ${activeIndex === index ? "bg-[#F6F0F8] text-[#31123F]" : "text-[#514656]"}`}
                >
                  {properties?.full_address ?? [properties?.name, properties?.place_formatted].filter(Boolean).join(", ")}
                </li>
              );
            })}
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
        <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noreferrer" className="shrink-0 underline hover:text-[#4C1268]">
          Powered by Mapbox
        </a>
      </div>
    </div>
  );
}
