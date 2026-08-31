"use client";

import { type FormEvent, useCallback, useState } from "react";
import { FiMapPin, FiX } from "react-icons/fi";

import { ApiError, firstFieldError } from "@/lib/api";
import { createAddress, updateAddress } from "@/lib/checkout/client";
import type { AddressPayload, CustomerAddress } from "@/lib/checkout/types";

import {
  MapboxAddressAutocomplete,
  type MapboxAddressSelection,
} from "./mapbox-address-autocomplete";
import { MapboxLocationPicker } from "./mapbox-location-picker";

type AddressFormValues = {
  type: "shipping" | "billing" | "both";
  label: string;
  recipient_name: string;
  contact_number: string;
  address_line_1: string;
  address_line_2: string;
  barangay: string;
  city_municipality: string;
  province: string;
  region: string;
  postal_code: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
};

const emptyValues: AddressFormValues = {
  type: "shipping",
  label: "Home",
  recipient_name: "",
  contact_number: "",
  address_line_1: "",
  address_line_2: "",
  barangay: "",
  city_municipality: "",
  province: "",
  region: "",
  postal_code: "",
  country: "Philippines",
  latitude: null,
  longitude: null,
  is_default: false,
};

const locationFields = new Set<keyof AddressFormValues>([
  "address_line_1",
  "address_line_2",
  "barangay",
  "city_municipality",
  "province",
  "region",
  "postal_code",
  "country",
]);

function numberOrNull(value: string | null) {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function initialValues(address?: CustomerAddress): AddressFormValues {
  if (!address) return emptyValues;

  return {
    type: address.type,
    label: address.label ?? "",
    recipient_name: address.recipientName,
    contact_number: address.contactNumber,
    address_line_1: address.addressLine1,
    address_line_2: address.addressLine2 ?? "",
    barangay: address.barangay,
    city_municipality: address.cityMunicipality,
    province: address.province,
    region: address.region,
    postal_code: address.postalCode,
    country: address.country,
    latitude: numberOrNull(address.latitude),
    longitude: numberOrNull(address.longitude),
    is_default: address.isDefault,
  };
}

export function AddressForm({
  address,
  mapboxAccessToken,
  onCancel,
  onSaved,
}: {
  address?: CustomerAddress;
  mapboxAccessToken: string;
  onCancel?: () => void;
  onSaved: (address: CustomerAddress) => void;
}) {
  const [values, setValues] = useState(() => initialValues(address));
  const [error, setError] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);

  const applyMapboxAddress = useCallback((selection: MapboxAddressSelection) => {
    setValues((current) => ({
      ...current,
      address_line_1: selection.addressLine1 || current.address_line_1,
      barangay: selection.barangay || current.barangay,
      city_municipality: selection.cityMunicipality || current.city_municipality,
      province: selection.province || current.province,
      region: selection.region || current.region,
      postal_code: selection.postalCode || current.postal_code,
      country: selection.country || current.country,
      latitude: selection.latitude,
      longitude: selection.longitude,
    }));
    setLocationMessage(
      "Location found. Review the address fields and adjust the map pin to the exact entrance.",
    );
  }, []);

  function update<K extends keyof AddressFormValues>(
    field: K,
    value: AddressFormValues[K],
  ) {
    setValues((current) => ({
      ...current,
      [field]: value,
      ...(locationFields.has(field) ? { latitude: null, longitude: null } : {}),
    }));
    if (locationFields.has(field)) setLocationMessage(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const payload: AddressPayload = {
      type: values.type,
      label: values.label.trim() || null,
      recipient_name: values.recipient_name,
      contact_number: values.contact_number,
      address_line_1: values.address_line_1,
      address_line_2: values.address_line_2.trim() || null,
      barangay: values.barangay,
      city_municipality: values.city_municipality,
      province: values.province,
      region: values.region,
      postal_code: values.postal_code,
      country: values.country,
      latitude: values.latitude,
      longitude: values.longitude,
      is_default: values.is_default,
    };

    try {
      onSaved(address ? await updateAddress(address.id, payload) : await createAddress(payload));
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError(0, { message: "We could not save this address." }),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="border border-[#DCD4DF] bg-[#FCFAFC] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#2D2231]">
            {address ? "Edit address" : "Add address"}
          </h2>
          <p className="mt-1 text-xs leading-5 text-[#746978]">
            Search with Mapbox or enter the address manually. Required fields are checked again at checkout.
          </p>
        </div>
        {onCancel ? (
          <button type="button" onClick={onCancel} aria-label="Close address form" className="grid size-9 shrink-0 place-items-center rounded-md text-[#665A6A] hover:bg-[#F0EBF1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]">
            <FiX aria-hidden="true" className="size-5" />
          </button>
        ) : null}
      </div>

      {mapboxAccessToken ? (
        <div className="mt-5">
          <MapboxAddressAutocomplete accessToken={mapboxAccessToken} onSelect={applyMapboxAddress} />
        </div>
      ) : (
        <div className="mt-5 flex gap-2 border-l-2 border-[#A897AE] pl-3 text-xs leading-5 text-[#665A6A]">
          <FiMapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Mapbox is not configured. You can still enter and save the address manually.
        </div>
      )}

      {locationMessage ? <p role="status" className="mt-3 text-xs leading-5 text-[#3F6846]">{locationMessage}</p> : null}
      {error ? <p role="alert" className="mt-4 border-l-2 border-[#FF3B30] pl-3 text-sm text-[#B42318]">{error.message}</p> : null}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="address-type" className="block text-sm font-semibold text-[#3A2E3E]">Address use *</label>
          <select id="address-type" value={values.type} onChange={(event) => update("type", event.target.value as AddressFormValues["type"])} className="mt-2 min-h-11 w-full rounded-md border border-[#CFC6D2] bg-white px-3 text-sm text-[#2D2231] outline-none focus:border-[#4C1268] focus:ring-3 focus:ring-[#4C1268]/10">
            <option value="shipping">Shipping</option>
            <option value="billing">Billing</option>
            <option value="both">Shipping and billing</option>
          </select>
        </div>
        <Field label="Address label" name="label" value={values.label} onChange={(value) => update("label", value)} error={firstFieldError(error, "label")} placeholder="Home or Office" />
        <Field label="Recipient name" name="recipient_name" required value={values.recipient_name} onChange={(value) => update("recipient_name", value)} error={firstFieldError(error, "recipient_name")} autoComplete="name" />
        <Field label="Contact number" name="contact_number" required value={values.contact_number} onChange={(value) => update("contact_number", value)} error={firstFieldError(error, "contact_number")} autoComplete="tel" inputMode="tel" />
        <Field label="Street, building, or house number" name="address_line_1" required value={values.address_line_1} onChange={(value) => update("address_line_1", value)} error={firstFieldError(error, "address_line_1")} autoComplete="address-line1" />
        <Field label="Unit, floor, or landmark" name="address_line_2" value={values.address_line_2} onChange={(value) => update("address_line_2", value)} error={firstFieldError(error, "address_line_2")} autoComplete="address-line2" />
        <Field label="Barangay" name="barangay" required value={values.barangay} onChange={(value) => update("barangay", value)} error={firstFieldError(error, "barangay")} />
        <Field label="City or municipality" name="city_municipality" required value={values.city_municipality} onChange={(value) => update("city_municipality", value)} error={firstFieldError(error, "city_municipality")} autoComplete="address-level2" />
        <Field label="Province" name="province" required value={values.province} onChange={(value) => update("province", value)} error={firstFieldError(error, "province")} autoComplete="address-level1" />
        <Field label="Region" name="region" required value={values.region} onChange={(value) => update("region", value)} error={firstFieldError(error, "region")} />
        <Field label="Postal code" name="postal_code" required value={values.postal_code} onChange={(value) => update("postal_code", value)} error={firstFieldError(error, "postal_code")} autoComplete="postal-code" inputMode="numeric" />
        <Field label="Country" name="country" required value={values.country} onChange={(value) => update("country", value)} error={firstFieldError(error, "country")} autoComplete="country-name" />
      </div>

      {mapboxAccessToken ? (
        <div className="mt-5">
          <p className="mb-2 text-sm font-semibold text-[#3A2E3E]">Pin the delivery location</p>
          <MapboxLocationPicker
            accessToken={mapboxAccessToken}
            latitude={values.latitude}
            longitude={values.longitude}
            onChange={({ latitude, longitude }) => {
              setValues((current) => ({ ...current, latitude, longitude }));
              setLocationMessage("Map pin updated. Review the coordinates before saving.");
            }}
          />
        </div>
      ) : null}

      <label className="mt-5 flex items-start gap-3 text-sm text-[#514656]">
        <input type="checkbox" checked={values.is_default} onChange={(event) => update("is_default", event.target.checked)} className="mt-0.5 size-4 rounded border-[#BFB5C3] accent-[#E6007A]" />
        Use as my default for the selected address use
      </label>

      <div className="mt-5 flex justify-end gap-3">
        {onCancel ? <button type="button" onClick={onCancel} className="min-h-10 rounded-md border border-[#CFC6D2] bg-white px-4 text-sm font-semibold text-[#4C1268] hover:bg-[#F6F0F8]">Cancel</button> : null}
        <button type="submit" disabled={submitting} className="min-h-10 rounded-md bg-[#E6007A] px-5 text-sm font-semibold text-white hover:bg-[#C8006B] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#4C1268] disabled:opacity-60">
          {submitting ? "Saving…" : address ? "Save changes" : "Save address"}
        </button>
      </div>
    </form>
  );
}

function Field({ autoComplete, error, inputMode, label, name, onChange, placeholder, required, value }: {
  autoComplete?: string;
  error?: string;
  inputMode?: "numeric" | "tel";
  label: string;
  name: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  value: string;
}) {
  const errorId = `${name}-error`;
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-semibold text-[#3A2E3E]">{label}{required ? " *" : ""}</label>
      <input id={name} name={name} required={required} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} inputMode={inputMode} placeholder={placeholder} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} className={`mt-2 min-h-11 w-full rounded-md border bg-white px-3 text-sm text-[#2D2231] outline-none focus:ring-3 ${error ? "border-[#FF3B30] focus:ring-[#FF3B30]/10" : "border-[#CFC6D2] focus:border-[#4C1268] focus:ring-[#4C1268]/10"}`} />
      {error ? <p id={errorId} role="alert" className="mt-1.5 text-xs text-[#B42318]">{error}</p> : null}
    </div>
  );
}
