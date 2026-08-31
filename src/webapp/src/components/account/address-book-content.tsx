"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FiEdit2, FiMapPin, FiPlus, FiTrash2 } from "react-icons/fi";

import { AddressForm } from "@/components/checkout/address-form";
import { ApiError } from "@/lib/api";
import {
  deleteAddress,
  fetchAddresses,
  updateAddress,
} from "@/lib/checkout/client";
import type { AddressPayload, CustomerAddress } from "@/lib/checkout/types";

function addressSummary(address: CustomerAddress) {
  return [
    address.addressLine1,
    address.addressLine2,
    address.barangay,
    address.cityMunicipality,
    address.province,
    address.postalCode,
  ]
    .filter(Boolean)
    .join(", ");
}

function payloadFor(address: CustomerAddress, isDefault = address.isDefault): AddressPayload {
  return {
    type: address.type,
    label: address.label,
    recipient_name: address.recipientName,
    contact_number: address.contactNumber,
    address_line_1: address.addressLine1,
    address_line_2: address.addressLine2,
    barangay: address.barangay,
    city_municipality: address.cityMunicipality,
    province: address.province,
    region: address.region,
    postal_code: address.postalCode,
    country: address.country,
    latitude: address.latitude === null ? null : Number(address.latitude),
    longitude: address.longitude === null ? null : Number(address.longitude),
    is_default: isDefault,
  };
}

function sharesUse(left: CustomerAddress, right: CustomerAddress) {
  if (left.type === "both" || right.type === "both") return true;
  return left.type === right.type;
}

export function AddressBookContent({
  geoapifyApiKey,
  mapboxAccessToken,
  returnTo,
}: {
  geoapifyApiKey: string;
  mapboxAccessToken: string;
  returnTo: "/checkout" | null;
}) {
  const router = useRouter();
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"success" | "error" | null>(null);
  const [editing, setEditing] = useState<CustomerAddress | "new" | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchAddresses(controller.signal)
      .then((items) => {
        setAddresses(items);
        setStatus("ready");
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setMessage(caught instanceof ApiError ? caught.message : "We could not load your addresses.");
        setStatus("error");
      });

    return () => controller.abort();
  }, []);

  function applySaved(saved: CustomerAddress) {
    setAddresses((current) => {
      const withoutSaved = current.filter((item) => item.id !== saved.id);
      return [
        saved,
        ...withoutSaved.map((item) =>
          saved.isDefault && sharesUse(saved, item)
            ? { ...item, isDefault: false }
            : item,
        ),
      ];
    });
    setEditing(null);
    setMessage("Address saved.");
    setMessageTone("success");
  }

  async function selectForCheckout(address: CustomerAddress) {
    if (!returnTo || address.type === "billing") return;
    setBusyId(address.id);
    setMessage(null);
    setMessageTone(null);

    try {
      const saved = await updateAddress(address.id, payloadFor(address, true));
      applySaved(saved);
      router.push(returnTo);
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : "We could not select this address.");
      setMessageTone("error");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(address: CustomerAddress) {
    setBusyId(address.id);
    setMessage(null);
    setMessageTone(null);
    try {
      await deleteAddress(address.id);
      setAddresses((current) => current.filter((item) => item.id !== address.id));
      setConfirmingDelete(null);
      setMessage("Address deleted.");
      setMessageTone("success");
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : "We could not delete this address.");
      setMessageTone("error");
    } finally {
      setBusyId(null);
    }
  }

  if (status === "loading") {
    return (
      <div aria-label="Loading saved addresses" className="space-y-3">
        {[0, 1].map((item) => <div key={item} className="h-36 animate-pulse border border-[#E2DCE4] bg-[#F2EEF3]" />)}
      </div>
    );
  }

  if (status === "error") {
    return (
      <section className="border border-[#E2DCE4] bg-white p-5">
        <p role="alert" className="text-sm text-[#B42318]">{message}</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-md border border-[#CFC6D2] px-4 py-2 text-sm font-semibold text-[#4C1268]">Try again</button>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#281E2C]">Addresses</h1>
          <p className="mt-1 text-sm leading-6 text-[#675B6B]">
            Manage reusable shipping and billing addresses and pin exact delivery locations.
          </p>
        </div>
        {editing === null ? (
          <button type="button" onClick={() => setEditing("new")} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[#E6007A] px-4 text-sm font-semibold text-white hover:bg-[#C8006B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4C1268]">
            <FiPlus aria-hidden="true" /> Add address
          </button>
        ) : null}
      </div>

      {returnTo ? (
        <p className="border-l-2 border-[#4C1268] pl-3 text-sm leading-6 text-[#514656]">
          Choose a shipping address below to return to checkout. Billing-only addresses remain available for account management.
        </p>
      ) : null}

      {message ? (
        <p role={messageTone === "error" ? "alert" : "status"} className={`text-sm ${messageTone === "error" ? "text-[#B42318]" : "text-[#3F6846]"}`}>
          {message}
        </p>
      ) : null}

      {editing ? (
        <AddressForm
          key={editing === "new" ? "new" : editing.id}
          address={editing === "new" ? undefined : editing}
          geoapifyApiKey={geoapifyApiKey}
          mapboxAccessToken={mapboxAccessToken}
          onCancel={() => setEditing(null)}
          onSaved={applySaved}
        />
      ) : null}

      {addresses.length === 0 && editing === null ? (
        <section className="border border-[#E2DCE4] bg-white p-6 text-center">
          <FiMapPin aria-hidden="true" className="mx-auto size-6 text-[#4C1268]" />
          <p className="mt-3 font-semibold text-[#302534]">No saved addresses</p>
          <p className="mt-1 text-sm text-[#746978]">Add an address before placing an order.</p>
        </section>
      ) : (
        <div className="grid gap-3">
          {addresses.map((address) => (
            <article key={address.id} className="border border-[#DED7E1] bg-white p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h2 className="font-semibold text-[#302534]">{address.label || "Saved address"}</h2>
                    <span className="text-xs text-[#746978]">
                      {address.type === "both" ? "Shipping and billing" : address.type === "shipping" ? "Shipping" : "Billing"}
                    </span>
                    {address.isDefault ? <span className="text-xs font-semibold text-[#6D1748]">Default</span> : null}
                  </div>
                  <p className="mt-2 text-sm text-[#514656]">{address.recipientName} · {address.contactNumber}</p>
                  <p className="mt-1 text-sm leading-6 text-[#746978]">{addressSummary(address)}</p>
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-[#746978]">
                    <FiMapPin aria-hidden="true" />
                    {address.latitude && address.longitude ? "Map pin saved" : "No map pin saved"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {returnTo && address.type !== "billing" ? (
                    <button type="button" onClick={() => void selectForCheckout(address)} disabled={busyId === address.id} className="min-h-9 rounded-md bg-[#4C1268] px-3 text-sm font-semibold text-white hover:bg-[#38104D] disabled:opacity-60">
                      {busyId === address.id ? "Selecting…" : "Use for checkout"}
                    </button>
                  ) : null}
                  <button type="button" onClick={() => { setEditing(address); setConfirmingDelete(null); }} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[#CFC6D2] px-3 text-sm font-semibold text-[#4C1268] hover:bg-[#F6F0F8]">
                    <FiEdit2 aria-hidden="true" /> Edit
                  </button>
                  <button type="button" onClick={() => setConfirmingDelete(address.id)} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[#E2B9C5] px-3 text-sm font-semibold text-[#9D174D] hover:bg-[#FFF1F5]">
                    <FiTrash2 aria-hidden="true" /> Delete
                  </button>
                </div>
              </div>

              {confirmingDelete === address.id ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#E9E4EB] pt-4">
                  <p className="text-sm text-[#514656]">Delete {address.label || "this address"}? Existing orders will keep their saved delivery snapshot.</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setConfirmingDelete(null)} className="min-h-9 rounded-md border border-[#CFC6D2] px-3 text-sm font-semibold text-[#4C1268]">Cancel</button>
                    <button type="button" onClick={() => void remove(address)} disabled={busyId === address.id} className="min-h-9 rounded-md bg-[#B42318] px-3 text-sm font-semibold text-white disabled:opacity-60">{busyId === address.id ? "Deleting…" : "Delete address"}</button>
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
