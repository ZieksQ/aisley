"use client";

import Link from "next/link";
import { useState } from "react";
import { FiEdit3, FiTrash2 } from "react-icons/fi";
import { HiMinus, HiPlus } from "react-icons/hi2";

import { ProductImage } from "@/components/marketplace/product-image";
import { ApiError } from "@/lib/api";
import type { CartItem } from "@/lib/cart/types";

import { useCart } from "./cart-provider";
import { VariationDialog } from "./variation-dialog";

const moneyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2,
});

const availabilityMessages: Record<
  Exclude<CartItem["availability"]["reason"], null>,
  string
> = {
  product_unavailable: "This product is no longer available.",
  variant_unavailable: "This variation is no longer available.",
  out_of_stock: "This item is out of stock.",
  insufficient_stock: "Quantity exceeds current stock.",
};

export function CartItemRow({
  item,
  onSelectedChange,
  selected,
}: {
  item: CartItem;
  onSelectedChange: (selected: boolean) => void;
  selected: boolean;
}) {
  const { removeItem, updateItem } = useCart();
  const [quantity, setQuantity] = useState(item.quantity);
  const [pendingAction, setPendingAction] = useState<
    "quantity" | "remove" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [editingVariation, setEditingVariation] = useState(false);

  const canChangeQuantity =
    item.availability.isAvailable ||
    item.availability.reason === "insufficient_stock";
  const maxQuantity = Math.max(1, item.availability.availableQuantity);
  const selectedOptions = item.selectedOptions
    .map((option) => `${option.group}: ${option.value}`)
    .join(" · ");

  async function commitQuantity(nextQuantity: number) {
    const bounded = Math.min(maxQuantity, Math.max(1, nextQuantity));
    setQuantity(bounded);
    if (bounded === item.quantity) return;

    setError(null);
    setPendingAction("quantity");
    try {
      await updateItem(item.id, { quantity: bounded });
    } catch (caught) {
      setQuantity(item.quantity);
      setError(
        caught instanceof ApiError
          ? caught.message
          : "We could not update the quantity. Please try again.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function remove() {
    setError(null);
    setPendingAction("remove");
    try {
      await removeItem(item.id);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "We could not remove this item. Please try again.",
      );
      setPendingAction(null);
    }
  }

  return (
    <article className="border-b border-[#E6E0E8] px-4 py-5 last:border-b-0 sm:px-5">
      <div className="grid grid-cols-[24px_88px_minmax(0,1fr)] gap-3 sm:grid-cols-[24px_112px_minmax(0,1fr)_auto] sm:gap-4">
        <div className="pt-1">
          <input
            type="checkbox"
            checked={selected}
            disabled={!item.availability.isAvailable}
            onChange={(event) => onSelectedChange(event.target.checked)}
            aria-label={`Select ${item.product.name} for checkout`}
            className="size-4 rounded border-[#BFB5C3] accent-[#E6007A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A] disabled:cursor-not-allowed"
          />
        </div>
        <Link
          href={item.product.url}
          className="relative aspect-square overflow-hidden rounded-md border border-[#E2DCE4] bg-[#F5F2F5] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]"
        >
          <ProductImage
            src={item.media.url}
            alt={item.media.altText}
            sizes="(max-width: 640px) 88px, 112px"
          />
        </Link>

        <div className="min-w-0">
          <Link
            href={item.product.url}
            className="line-clamp-2 text-sm font-semibold leading-5 text-[#2E2432] hover:text-[#C8006B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A] sm:text-base"
          >
            {item.product.name}
          </Link>

          {selectedOptions ? (
            <p className="mt-1 text-xs leading-5 text-[#665A6A] sm:text-sm">
              {selectedOptions}
            </p>
          ) : null}
          {item.variant?.sku ? (
            <p className="mt-0.5 text-xs text-[#887D8B]">SKU {item.variant.sku}</p>
          ) : null}

          {!item.availability.isAvailable && item.availability.reason ? (
            <p className="mt-2 text-sm font-medium text-[#B42318]">
              {availabilityMessages[item.availability.reason]}
              {item.availability.reason === "insufficient_stock"
                ? ` ${item.availability.availableQuantity} available.`
                : ""}
            </p>
          ) : (
            <p className="mt-2 text-xs text-[#5F725E]">
              {item.availability.availableQuantity} available
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 sm:hidden">
            <strong className="text-base text-[#E6007A]">
              {moneyFormatter.format(item.unitPrice)}
            </strong>
            <span className="text-xs text-[#746978]">
              Subtotal {moneyFormatter.format(item.lineSubtotal)}
            </span>
          </div>
        </div>

        <div className="hidden min-w-36 text-right sm:block">
          <strong className="text-base text-[#E6007A]">
            {moneyFormatter.format(item.unitPrice)}
          </strong>
          <p className="mt-1 text-xs text-[#746978]">
            Subtotal {moneyFormatter.format(item.lineSubtotal)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pl-0 sm:pl-40">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[#514656]">Quantity</span>
          <div className="flex h-9 overflow-hidden rounded-md border border-[#CFC6D2] bg-white">
            <button
              type="button"
              aria-label={`Decrease quantity for ${item.product.name}`}
              disabled={
                !canChangeQuantity || quantity <= 1 || pendingAction !== null
              }
              onClick={() => void commitQuantity(quantity - 1)}
              className="grid w-9 place-items-center text-[#514656] hover:bg-[#F5F1F5] disabled:cursor-not-allowed disabled:text-[#B3AAB6]"
            >
              <HiMinus aria-hidden="true" className="size-4" />
            </button>
            <input
              aria-label={`Quantity for ${item.product.name}`}
              inputMode="numeric"
              value={quantity}
              disabled={!canChangeQuantity || pendingAction !== null}
              onChange={(event) => {
                const value = Number.parseInt(event.target.value, 10);
                if (!Number.isNaN(value)) {
                  setQuantity(Math.min(maxQuantity, Math.max(1, value)));
                }
              }}
              onBlur={() => void commitQuantity(quantity)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              className="w-11 border-x border-[#E3DDE5] text-center text-sm outline-none focus:bg-[#FFF7FB] disabled:bg-[#F4F1F5]"
            />
            <button
              type="button"
              aria-label={`Increase quantity for ${item.product.name}`}
              disabled={
                !canChangeQuantity ||
                quantity >= maxQuantity ||
                pendingAction !== null
              }
              onClick={() => void commitQuantity(quantity + 1)}
              className="grid w-9 place-items-center text-[#514656] hover:bg-[#F5F1F5] disabled:cursor-not-allowed disabled:text-[#B3AAB6]"
            >
              <HiPlus aria-hidden="true" className="size-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {item.variant ? (
            <button
              type="button"
              onClick={() => setEditingVariation(true)}
              disabled={pendingAction !== null}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-[#4C1268] hover:bg-[#F6F0F8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A] disabled:opacity-60"
            >
              <FiEdit3 aria-hidden="true" className="size-4" />
              Change variation
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void remove()}
            disabled={pendingAction !== null}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-[#8C3046] hover:bg-[#FFF1F4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B42318] disabled:opacity-60"
          >
            <FiTrash2 aria-hidden="true" className="size-4" />
            {pendingAction === "remove" ? "Removing…" : "Remove"}
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-[#B42318] sm:pl-40">
          {error}
        </p>
      ) : null}

      {editingVariation ? (
        <VariationDialog item={item} onClose={() => setEditingVariation(false)} />
      ) : null}
    </article>
  );
}
