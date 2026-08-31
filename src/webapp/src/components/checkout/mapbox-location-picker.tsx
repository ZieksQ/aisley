"use client";

import { useEffect, useRef } from "react";

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

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!containerRef.current || !accessToken) return;

    let disposed = false;

    void import("mapbox-gl").then(({ default: mapboxgl }) => {
      if (disposed || !containerRef.current) return;

      mapboxgl.accessToken = accessToken;
      const hasLocation = latitude !== null && longitude !== null;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: hasLocation ? [longitude, latitude] : PHILIPPINES_CENTER,
        zoom: hasLocation ? 16 : 4.8,
      });
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

      if (hasLocation) placePin({ latitude, longitude }, false);

      map.on("click", (event) => {
        placePin({ latitude: event.lngLat.lat, longitude: event.lngLat.lng }, true);
      });
    });

    return () => {
      disposed = true;
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // Initial map setup is intentionally independent from later pin changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  return (
    <div>
      <div
        ref={containerRef}
        role="region"
        aria-label="Mapbox address location picker"
        className="h-72 w-full overflow-hidden rounded-md border border-[#CFC6D2] bg-[#ECE7EE]"
      />
      <p className="mt-2 text-xs leading-5 text-[#746978]">
        Click the map or drag the pin to the exact entrance. This saves coordinates for future delivery routing.
      </p>
      <p aria-live="polite" className="mt-1 text-xs font-medium text-[#514656]">
        {latitude !== null && longitude !== null
          ? `Pinned at ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
          : "No location pinned yet."}
      </p>
    </div>
  );
}
