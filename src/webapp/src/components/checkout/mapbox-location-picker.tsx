"use client";

import { useEffect, useRef, useState } from "react";
import { FiCrosshair } from "react-icons/fi";

type Coordinates = { latitude: number; longitude: number };

const PHILIPPINES_CENTER: [number, number] = [122.0, 12.5];

export function MapboxLocationPicker({
  accessToken,
  latitude,
  longitude,
  onChange,
}: {
  accessToken: string;
  latitude: number | null;
  longitude: number | null;
  onChange: (coordinates: Coordinates) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("mapbox-gl").Map | null>(null);
  const markerRef = useRef<import("mapbox-gl").Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const coordinatesRef = useRef({ latitude, longitude });
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    coordinatesRef.current = { latitude, longitude };
  }, [latitude, longitude]);

  useEffect(() => {
    if (!containerRef.current || !accessToken) return;

    let disposed = false;

    void import("mapbox-gl")
      .then(({ default: mapboxgl }) => {
        if (disposed || !containerRef.current) return;

        if (!mapboxgl.supported()) {
          setMapUnavailable(true);
          return;
        }

        mapboxgl.accessToken = accessToken;
        const currentLatitude = coordinatesRef.current.latitude;
        const currentLongitude = coordinatesRef.current.longitude;
        const hasLocation = currentLatitude !== null && currentLongitude !== null;
        let map: import("mapbox-gl").Map;

        try {
          map = new mapboxgl.Map({
            container: containerRef.current,
            style: "mapbox://styles/mapbox/streets-v12",
            center: hasLocation ? [currentLongitude, currentLatitude] : PHILIPPINES_CENTER,
            zoom: hasLocation ? 16 : 4.8,
          });
        } catch {
          setMapUnavailable(true);
          return;
        }

        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
        mapRef.current = map;

        function placePin(point: Coordinates, notify: boolean) {
          if (!markerRef.current) {
            markerRef.current = new mapboxgl.Marker({
              color: "#E6007A",
              draggable: true,
            })
              .setLngLat([point.longitude, point.latitude])
              .addTo(map);
            markerRef.current.on("dragend", () => {
              const position = markerRef.current?.getLngLat();
              if (position) {
                onChangeRef.current({
                  latitude: position.lat,
                  longitude: position.lng,
                });
              }
            });
          } else {
            markerRef.current.setLngLat([point.longitude, point.latitude]);
          }

          if (notify) onChangeRef.current(point);
        }

        if (hasLocation) placePin({ latitude: currentLatitude, longitude: currentLongitude }, false);

        map.on("click", (event) => {
          placePin({ latitude: event.lngLat.lat, longitude: event.lngLat.lng }, true);
        });
      })
      .catch(() => {
        if (!disposed) setMapUnavailable(true);
      });

    return () => {
      disposed = true;
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [accessToken]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (latitude === null || longitude === null) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    void import("mapbox-gl").then(({ default: mapboxgl }) => {
      if (!mapRef.current) return;
      if (!markerRef.current) {
        markerRef.current = new mapboxgl.Marker({ color: "#E6007A", draggable: true })
          .setLngLat([longitude, latitude])
          .addTo(map);
        markerRef.current.on("dragend", () => {
          const position = markerRef.current?.getLngLat();
          if (position) onChangeRef.current({ latitude: position.lat, longitude: position.lng });
        });
      } else {
        markerRef.current.setLngLat([longitude, latitude]);
      }
      map.flyTo({ center: [longitude, latitude], zoom: Math.max(map.getZoom(), 15) });
    });
  }, [latitude, longitude]);

  function useCurrentLocation() {
    setLocationError(null);

    if (!("geolocation" in navigator)) {
      setLocationError("Location access is not supported by this browser.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        onChangeRef.current({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        setLocating(false);

        if (error.code === error.PERMISSION_DENIED) {
          setLocationError("Location permission was denied. Allow location access in your browser and try again.");
          return;
        }

        if (error.code === error.TIMEOUT) {
          setLocationError("Your location took too long to detect. Try again or place the pin manually.");
          return;
        }

        setLocationError("Your current location could not be detected. Try again or place the pin manually.");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 30_000,
        timeout: 15_000,
      },
    );
  }

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={locating}
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[#CFC6D2] bg-white px-3 text-sm font-semibold text-[#4C1268] hover:bg-[#F6F0F8] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A] disabled:cursor-wait disabled:opacity-60"
        >
          <FiCrosshair aria-hidden="true" className={locating ? "size-4 animate-spin" : "size-4"} />
          {locating ? "Finding your location…" : "Use my location"}
        </button>
      </div>
      {mapUnavailable ? (
        <div role="status" className="border-l-2 border-[#FF8800] bg-[#FFF8EF] px-3 py-2 text-sm leading-5 text-[#6B4516]">
          The interactive map is unavailable in this browser. You can still use an address suggestion or enter the address manually.
        </div>
      ) : (
        <>
          <div
            ref={containerRef}
            role="region"
            aria-label="Mapbox address location picker"
            className="h-72 w-full overflow-hidden rounded-md border border-[#CFC6D2] bg-[#ECE7EE]"
          />
          <p className="mt-2 text-xs leading-5 text-[#746978]">
            Click the map or drag the pin to the exact entrance. This saves coordinates for future delivery routing.
          </p>
        </>
      )}
      <p aria-live="polite" className="mt-1 text-xs font-medium text-[#514656]">
        {latitude !== null && longitude !== null
          ? `Pinned at ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
          : "No location pinned yet."}
      </p>
      {locationError ? (
        <p role="alert" className="mt-2 border-l-2 border-[#FF3B30] pl-3 text-xs leading-5 text-[#B42318]">
          {locationError}
        </p>
      ) : null}
    </div>
  );
}
