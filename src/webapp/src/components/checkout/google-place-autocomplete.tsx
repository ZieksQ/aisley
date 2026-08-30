"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { FiMapPin } from "react-icons/fi";

export type GoogleAddressSelection = {
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

type GoogleAddressComponent = {
  longText: string;
  shortText: string;
  types: string[];
};

type GooglePlace = {
  addressComponents?: GoogleAddressComponent[];
  fetchFields: (options: { fields: string[] }) => Promise<void>;
  location?: {
    lat: number | (() => number);
    lng: number | (() => number);
  };
};

type GooglePlaceSelectEvent = Event & {
  placePrediction?: { toPlace: () => GooglePlace };
};

type GoogleAutocompleteElement = HTMLElement & {
  includedRegionCodes?: string[];
  placeholder?: string;
};

type GoogleMapsWindow = Window & {
  google?: {
    maps: {
      importLibrary: (library: "places") => Promise<{
        PlaceAutocompleteElement: new () => GoogleAutocompleteElement;
      }>;
    };
  };
};

function coordinate(value: number | (() => number)) {
  return typeof value === "function" ? value() : value;
}

function component(
  components: GoogleAddressComponent[],
  ...types: string[]
) {
  return components.find((item) =>
    types.some((type) => item.types.includes(type)),
  )?.longText;
}

export function GooglePlaceAutocomplete({
  apiKey,
  onSelect,
}: {
  apiKey: string;
  onSelect: (selection: GoogleAddressSelection) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );

  const initialize = useCallback(async () => {
    const mapsWindow = window as GoogleMapsWindow;
    if (!containerRef.current || !mapsWindow.google?.maps) return;

    setStatus("loading");
    try {
      const { PlaceAutocompleteElement } =
        await mapsWindow.google.maps.importLibrary("places");
      const autocomplete = new PlaceAutocompleteElement();
      autocomplete.includedRegionCodes = ["ph"];
      autocomplete.placeholder = "Search barangay, city, building, or street";
      autocomplete.className = "block min-h-12 w-full text-[15px]";

      const handleSelect = async (event: Event) => {
        const place = (event as GooglePlaceSelectEvent).placePrediction?.toPlace();
        if (!place) return;

        await place.fetchFields({ fields: ["addressComponents", "location"] });
        if (!place.location) return;

        const components = place.addressComponents ?? [];
        const streetNumber = component(components, "street_number");
        const route = component(components, "route");
        const premise = component(components, "premise", "subpremise");
        const addressLine1 = [premise, streetNumber, route]
          .filter(Boolean)
          .join(" ");
        const administrativeArea = component(
          components,
          "administrative_area_level_1",
        );

        onSelect({
          addressLine1: addressLine1 || undefined,
          barangay: component(
            components,
            "sublocality_level_1",
            "sublocality",
            "neighborhood",
          ),
          cityMunicipality: component(
            components,
            "locality",
            "administrative_area_level_2",
          ),
          province:
            component(components, "administrative_area_level_2") ??
            administrativeArea,
          region: administrativeArea,
          postalCode: component(components, "postal_code"),
          country: component(components, "country"),
          latitude: coordinate(place.location.lat),
          longitude: coordinate(place.location.lng),
        });
      };

      autocomplete.addEventListener("gmp-select", handleSelect);
      containerRef.current.replaceChildren(autocomplete);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [onSelect]);

  useEffect(() => {
    if (scriptReady) void initialize();
  }, [initialize, scriptReady]);

  return (
    <div>
      <Script
        id="google-maps-checkout"
        src={`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async`}
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
        onError={() => setStatus("error")}
      />
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#31123F]">
        <FiMapPin aria-hidden="true" className="size-4" />
        Find your address with Google
      </div>
      <div
        ref={containerRef}
        className="min-h-12 rounded-md border border-[#D9D3DE] bg-white p-1 focus-within:border-[#4C1268] focus-within:ring-3 focus-within:ring-[#4C1268]/10"
      >
        {status === "loading" || status === "idle" ? (
          <div className="flex min-h-10 items-center px-3 text-sm text-[#746978]">
            Loading address suggestions…
          </div>
        ) : null}
      </div>
      <p aria-live="polite" className="mt-2 text-xs leading-5 text-[#746978]">
        {status === "error"
          ? "Google suggestions are unavailable. Enter the address manually below."
          : "Choose a suggestion to fill location fields, then review every detail."}
      </p>
    </div>
  );
}
