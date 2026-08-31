"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import {
  fetchPsgcOptions,
  type PsgcAddressOption,
} from "@/lib/locations/psgc-options";

export type AdministrativeAddressField =
  | "region"
  | "province"
  | "city_municipality"
  | "barangay";

type AdministrativeValues = Record<AdministrativeAddressField, string>;

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^(city|municipality|province|barangay|brgy)\s+(of\s+)?/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function matchingOption(options: PsgcAddressOption[], value: string) {
  const target = normalize(value);
  if (!target) return null;

  return options.find((option) => normalize(option.name) === target) ?? null;
}

export function PsgcAddressFields({
  errors,
  onCanonicalize,
  onUserChange,
  values,
}: {
  errors: Partial<Record<AdministrativeAddressField, string>>;
  onCanonicalize: (field: AdministrativeAddressField, value: string) => void;
  onUserChange: (field: AdministrativeAddressField, value: string) => void;
  values: AdministrativeValues;
}) {
  const [regions, setRegions] = useState<PsgcAddressOption[]>([]);
  const [provinceResult, setProvinceResult] = useState({ parent: "", options: [] as PsgcAddressOption[] });
  const [municipalityResult, setMunicipalityResult] = useState({ parent: "", options: [] as PsgcAddressOption[] });
  const [barangayResult, setBarangayResult] = useState({ parent: "", options: [] as PsgcAddressOption[] });
  const [unavailable, setUnavailable] = useState(false);

  const region = useMemo(() => matchingOption(regions, values.region), [regions, values.region]);
  const provinces = useMemo(
    () => provinceResult.parent === region?.code ? provinceResult.options : [],
    [provinceResult, region?.code],
  );
  const province = useMemo(
    () => matchingOption(provinces, values.province),
    [provinces, values.province],
  );
  const municipalityParent = region ? `${region.code}:${province?.code ?? ""}` : "";
  const municipalities = useMemo(
    () => municipalityResult.parent === municipalityParent ? municipalityResult.options : [],
    [municipalityParent, municipalityResult],
  );
  const municipality = useMemo(
    () => matchingOption(municipalities, values.city_municipality),
    [municipalities, values.city_municipality],
  );
  const barangayParent = region && municipality
    ? `${region.code}:${province?.code ?? ""}:${municipality.code}`
    : "";
  const barangays = useMemo(
    () => barangayResult.parent === barangayParent ? barangayResult.options : [],
    [barangayParent, barangayResult],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchPsgcOptions("regions", {}, controller.signal)
      .then((options) => {
        setRegions(options);
        setUnavailable(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setUnavailable(true);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!region) return;

    const controller = new AbortController();
    fetchPsgcOptions("provinces", { reg: region.code }, controller.signal)
      .then((options) => {
        setProvinceResult({ parent: region.code, options });
        setUnavailable(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setProvinceResult({ parent: region.code, options: [] });
          setUnavailable(true);
        }
      });

    return () => controller.abort();
  }, [region]);

  useEffect(() => {
    if (!region) return;

    const controller = new AbortController();
    const filters: Record<string, string> = { reg: region.code };
    if (province) filters.prv = province.code;
    fetchPsgcOptions("municipalities", filters, controller.signal)
      .then((options) => {
        setMunicipalityResult({ parent: municipalityParent, options });
        setUnavailable(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setMunicipalityResult({ parent: municipalityParent, options: [] });
          setUnavailable(true);
        }
      });

    return () => controller.abort();
  }, [municipalityParent, province, region]);

  useEffect(() => {
    if (!region || !municipality) return;

    const controller = new AbortController();
    const filters: Record<string, string> = {
      reg: region.code,
      mun: municipality.code,
    };
    if (province) filters.prv = province.code;
    fetchPsgcOptions("barangays", filters, controller.signal)
      .then((options) => {
        setBarangayResult({ parent: barangayParent, options });
        setUnavailable(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setBarangayResult({ parent: barangayParent, options: [] });
          setUnavailable(true);
        }
      });

    return () => controller.abort();
  }, [barangayParent, municipality, province, region]);

  useEffect(() => {
    if (region && region.name !== values.region) onCanonicalize("region", region.name);
  }, [onCanonicalize, region, values.region]);

  useEffect(() => {
    if (province && province.name !== values.province) {
      onCanonicalize("province", province.name);
    }
  }, [onCanonicalize, province, values.province]);

  useEffect(() => {
    if (municipality && municipality.name !== values.city_municipality) {
      onCanonicalize("city_municipality", municipality.name);
    }
  }, [municipality, onCanonicalize, values.city_municipality]);

  const barangay = useMemo(
    () => matchingOption(barangays, values.barangay),
    [barangays, values.barangay],
  );

  useEffect(() => {
    if (barangay && barangay.name !== values.barangay) {
      onCanonicalize("barangay", barangay.name);
    }
  }, [barangay, onCanonicalize, values.barangay]);

  return (
    <>
      <SearchablePsgcField
        error={errors.region}
        label="Region"
        loading={regions.length === 0 && !unavailable}
        name="region"
        onChange={(value) => onUserChange("region", value)}
        options={regions}
        required
        value={values.region}
      />
      <SearchablePsgcField
        error={errors.province}
        label="Province"
        loading={Boolean(region) && provinceResult.parent !== region?.code}
        name="province"
        onChange={(value) => onUserChange("province", value)}
        options={provinces}
        required
        value={values.province}
      />
      <SearchablePsgcField
        error={errors.city_municipality}
        label="City or municipality"
        loading={Boolean(region) && municipalityResult.parent !== municipalityParent}
        name="city_municipality"
        onChange={(value) => onUserChange("city_municipality", value)}
        options={municipalities}
        required
        value={values.city_municipality}
      />
      <SearchablePsgcField
        error={errors.barangay}
        label="Barangay"
        loading={Boolean(municipality) && barangayResult.parent !== barangayParent}
        name="barangay"
        onChange={(value) => onUserChange("barangay", value)}
        options={barangays}
        required
        value={values.barangay}
      />
      <p className="text-xs leading-5 text-[#746978] sm:col-span-2">
        Type to search official PSA PSGC options. Select Region first, followed by Province, City or Municipality, and Barangay.
      </p>
      {unavailable ? (
        <p role="status" className="border-l-2 border-[#FF8800] pl-3 text-xs leading-5 text-[#6B4516] sm:col-span-2">
          Official address options are temporarily unavailable. You can still enter the administrative address manually.
        </p>
      ) : null}
    </>
  );
}

function SearchablePsgcField({
  error,
  label,
  loading,
  name,
  onChange,
  options,
  required,
  value,
}: {
  error?: string;
  label: string;
  loading: boolean;
  name: AdministrativeAddressField;
  onChange: (value: string) => void;
  options: PsgcAddressOption[];
  required?: boolean;
  value: string;
}) {
  const listboxId = useId();
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const query = normalize(value);
  const filteredOptions = useMemo(
    () => options.filter((option) => !query || normalize(option.name).includes(query)).slice(0, 60),
    [options, query],
  );
  const errorId = `${name}-error`;

  useEffect(
    () => () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    },
    [],
  );

  function select(option: PsgcAddressOption) {
    onChange(option.name);
    setOpen(false);
    setActiveIndex(-1);
  }

  return (
    <div className="relative">
      <label htmlFor={name} className="block text-sm font-semibold text-[#3A2E3E]">
        {label}{required ? " *" : ""}
      </label>
      <input
        id={name}
        name={name}
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={open && filteredOptions.length > 0}
        aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        autoComplete={name === "city_municipality" ? "address-level2" : name === "province" ? "address-level1" : undefined}
        required={required}
        value={value}
        placeholder={loading ? `Loading ${label.toLowerCase()} options…` : `Search or enter ${label.toLowerCase()}`}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => {
          if (blurTimer.current) clearTimeout(blurTimer.current);
          setOpen(true);
        }}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={(event) => {
          if (!open || filteredOptions.length === 0) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((current) => (current + 1) % filteredOptions.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((current) => current <= 0 ? filteredOptions.length - 1 : current - 1);
          } else if (event.key === "Enter" && activeIndex >= 0) {
            event.preventDefault();
            select(filteredOptions[activeIndex]);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        className={`mt-2 min-h-11 w-full rounded-md border bg-white px-3 text-sm text-[#2D2231] outline-none focus:ring-3 ${error ? "border-[#FF3B30] focus:ring-[#FF3B30]/10" : "border-[#CFC6D2] focus:border-[#4C1268] focus:ring-[#4C1268]/10"}`}
      />

      {open && filteredOptions.length > 0 ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-[#D9D3DE] bg-white py-1 shadow-[0_2px_8px_rgba(45,34,49,0.12)]"
        >
          {filteredOptions.map((option, index) => (
            <li
              id={`${listboxId}-${index}`}
              key={option.code}
              role="option"
              aria-selected={activeIndex === index}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => select(option)}
              className={`cursor-pointer px-3 py-2.5 text-sm ${activeIndex === index ? "bg-[#F6F0F8] text-[#31123F]" : "text-[#514656]"}`}
            >
              {option.name}
            </li>
          ))}
        </ul>
      ) : null}

      {error ? <p id={errorId} role="alert" className="mt-1.5 text-xs text-[#B42318]">{error}</p> : null}
    </div>
  );
}
