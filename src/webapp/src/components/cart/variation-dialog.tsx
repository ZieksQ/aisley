"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FiX } from "react-icons/fi";
import { HiCheck } from "react-icons/hi2";

import { ProductImage } from "@/components/marketplace/product-image";
import { ApiError } from "@/lib/api";
import type { CartItem } from "@/lib/cart/types";
import { fetchProductDetail } from "@/lib/marketplace/client";
import type {
  ProductDetail,
  ProductVariant,
} from "@/lib/marketplace/types";

import { useCart } from "./cart-provider";

const moneyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2,
});

function valuesForVariant(product: ProductDetail, variant: ProductVariant) {
  return Object.fromEntries(
    product.optionGroups.flatMap((group) => {
      const value = group.values.find((option) =>
        variant.optionValueIds.includes(option.id),
      );
      return value ? [[group.id, value.id]] : [];
    }),
  );
}

export function VariationDialog({
  item,
  onClose,
}: {
  item: CartItem;
  onClose: () => void;
}) {
  const { updateItem } = useCart();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [selectedValues, setSelectedValues] = useState<Record<string, string>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchProductDetail(item.product.id, controller.signal)
      .then((detail) => {
        const currentVariant = detail.variants.find(
          (variant) => variant.id === item.variant?.id,
        );
        if (!currentVariant) {
          setError("This variation is no longer available to edit.");
          return;
        }

        setProduct(detail);
        setSelectedValues(valuesForVariant(detail, currentVariant));
      })
      .catch((caught: unknown) => {
        if (!(caught instanceof DOMException && caught.name === "AbortError")) {
          setError(
            caught instanceof ApiError
              ? caught.message
              : "We could not load the available variations.",
          );
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [item.product.id, item.variant?.id]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  const selectedIds = Object.values(selectedValues);
  const selectedVariant = useMemo(
    () =>
      product?.variants.find(
        (variant) =>
          variant.optionValueIds.length === product.optionGroups.length &&
          variant.optionValueIds.every((id) => selectedIds.includes(id)),
      ) ?? null,
    [product, selectedIds],
  );
  const complete =
    product !== null && selectedIds.length === product.optionGroups.length;
  const selectedMedia = selectedVariant?.primaryMediaId
    ? product?.media.find(
        (media) => media.id === selectedVariant.primaryMediaId,
      )
    : product?.media[0];

  function isValueAvailable(groupId: string, valueId: string) {
    if (!product) return false;
    const requiredIds = Object.entries(selectedValues)
      .filter(([selectedGroupId]) => selectedGroupId !== groupId)
      .map(([, selectedValueId]) => selectedValueId);

    return product.variants.some(
      (variant) =>
        variant.inStock &&
        variant.optionValueIds.includes(valueId) &&
        requiredIds.every((id) => variant.optionValueIds.includes(id)),
    );
  }

  async function confirm() {
    if (!selectedVariant || !selectedVariant.inStock) return;
    setSubmitting(true);
    setError(null);
    try {
      await updateItem(item.id, { variant_id: selectedVariant.id });
      onClose();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "We could not change this variation. Please try again.",
      );
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#25172B]/55 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`variation-title-${item.id}`}
        className="max-h-[min(680px,calc(100vh-2rem))] w-full max-w-lg overflow-y-auto rounded-lg border border-[#D8D0DA] bg-white shadow-[0_2px_8px_rgba(49,18,63,0.16)]"
      >
        <div className="flex items-center justify-between border-b border-[#E6E0E8] px-5 py-4">
          <h2
            id={`variation-title-${item.id}`}
            className="text-lg font-semibold text-[#2C2130]"
          >
            Change variation
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close variation editor"
            className="grid size-9 place-items-center rounded-md text-[#5F5363] hover:bg-[#F4F0F5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]"
          >
            <FiX aria-hidden="true" className="size-5" />
          </button>
        </div>

        <div className="p-5">
          {loading ? (
            <div aria-label="Loading variations" className="space-y-3">
              <div className="h-5 w-48 animate-pulse bg-[#EEE9EF]" />
              <div className="h-10 w-full animate-pulse bg-[#F2EEF3]" />
              <div className="h-10 w-4/5 animate-pulse bg-[#F2EEF3]" />
            </div>
          ) : null}

          {product ? (
            <>
              <div className="flex gap-3 border-b border-[#EEE9EF] pb-4">
                <div className="relative size-20 shrink-0 overflow-hidden rounded-md border border-[#E2DCE4] bg-[#F5F2F5]">
                  <ProductImage
                    src={selectedMedia?.url ?? item.media.url}
                    alt={selectedMedia?.altText ?? item.media.altText}
                    sizes="80px"
                  />
                </div>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-semibold text-[#312635]">
                    {item.product.name}
                  </p>
                  {selectedVariant ? (
                    <>
                      <p className="mt-2 text-base font-semibold text-[#E6007A]">
                        {moneyFormatter.format(selectedVariant.price)}
                      </p>
                      <p className="mt-0.5 text-xs text-[#6C6070]">
                        {selectedVariant.stockQuantity} available · SKU {selectedVariant.sku}
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-[#746978]">
                      Complete the selection to see price and stock.
                    </p>
                  )}
                </div>
              </div>

              {product.optionGroups.map((group) => (
                <fieldset key={group.id} className="mt-5">
                  <legend className="text-sm font-semibold text-[#302534]">
                    {group.name}
                  </legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {group.values.map((option) => {
                      const selected = selectedValues[group.id] === option.id;
                      const available = isValueAvailable(group.id, option.id);
                      return (
                        <button
                          key={option.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          disabled={!available && !selected}
                          onClick={() => {
                            setError(null);
                            setSelectedValues((current) => {
                              const nextValues = { ...current };
                              if (nextValues[group.id] === option.id) {
                                delete nextValues[group.id];
                              } else {
                                nextValues[group.id] = option.id;
                              }
                              return nextValues;
                            });
                          }}
                          className={`min-h-10 rounded-md border px-3 py-2 text-sm font-medium focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A] disabled:cursor-not-allowed disabled:border-[#E3DDE5] disabled:bg-[#F4F1F5] disabled:text-[#A097A3] ${
                            selected
                              ? "border-[#E6007A] bg-[#FFF3F9] text-[#A10056]"
                              : "border-[#CFC6D2] text-[#3D3241] hover:border-[#8C7A91]"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            {option.swatch.color ? (
                              <span
                                aria-hidden="true"
                                className="size-4 rounded-sm border border-black/15"
                                style={{ backgroundColor: option.swatch.color }}
                              />
                            ) : null}
                            {option.value}
                            {selected ? (
                              <HiCheck aria-hidden="true" className="size-4" />
                            ) : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </>
          ) : null}

          {error ? (
            <p role="alert" className="mt-4 text-sm text-[#B42318]">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-[#E6E0E8] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-md border border-[#D5CDD7] px-4 text-sm font-semibold text-[#4D4151] hover:bg-[#F6F3F6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4C1268]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={
              !complete ||
              !selectedVariant?.inStock ||
              selectedVariant.id === item.variant?.id ||
              submitting
            }
            className="min-h-10 rounded-md bg-[#E6007A] px-4 text-sm font-semibold text-white hover:bg-[#C8006B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4C1268] disabled:cursor-not-allowed disabled:bg-[#CFC6D2]"
          >
            {submitting ? "Updating…" : "Confirm variation"}
          </button>
        </div>
      </div>
    </div>
  );
}
