"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { HiCheck, HiMinus, HiPlus, HiShoppingCart } from "react-icons/hi2";

import { useAuth } from "@/components/auth/auth-provider";
import { useCart } from "@/components/cart/cart-provider";
import { ApiError } from "@/lib/api";
import type {
  ProductDetail,
  ProductVariant,
} from "@/lib/marketplace/types";

const moneyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2,
});

const badgeLabels: Record<string, string> = {
  best_seller: "Best seller",
  free_shipping: "Free shipping",
  new_arrival: "New arrival",
  top_product: "Top product",
  top_rated: "Top rated",
};

const pendingCartIntentKey = "aisley:pending-cart-intent";

type PendingCartIntent = {
  productId: string;
  variantId: string | null;
  quantity: number;
};

function selectedValuesForVariant(
  product: ProductDetail,
  variant: ProductVariant,
) {
  return Object.fromEntries(
    product.optionGroups.flatMap((group) => {
      const selectedValue = group.values.find((value) =>
        variant.optionValueIds.includes(value.id),
      );
      return selectedValue ? [[group.id, selectedValue.id]] : [];
    }),
  );
}

function readPendingCartIntent(): PendingCartIntent | null {
  try {
    const value = sessionStorage.getItem(pendingCartIntentKey);
    if (!value) return null;

    const parsed = JSON.parse(value) as Partial<PendingCartIntent>;
    return typeof parsed.productId === "string" &&
      (typeof parsed.variantId === "string" || parsed.variantId === null) &&
      typeof parsed.quantity === "number" &&
      Number.isSafeInteger(parsed.quantity) &&
      parsed.quantity > 0
      ? (parsed as PendingCartIntent)
      : null;
  } catch {
    return null;
  }
}

function savePendingCartIntent(intent: PendingCartIntent) {
  sessionStorage.setItem(pendingCartIntentKey, JSON.stringify(intent));
}

export function ProductPurchasePanel({
  onSelectedVariantChange,
  product,
}: {
  onSelectedVariantChange: (variant: ProductVariant | null) => void;
  product: ProductDetail;
}) {
  const router = useRouter();
  const { auth, refresh: refreshAuth } = useAuth();
  const { addItem } = useCart();
  const [selectedValues, setSelectedValues] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const restoredIntent = useRef(false);

  const selectedIds = Object.values(selectedValues);
  const selectedVariant = useMemo(
    () =>
      product.variants.find(
        (variant) =>
          variant.optionValueIds.length === product.optionGroups.length &&
          variant.optionValueIds.every((id) => selectedIds.includes(id)),
      ) ?? null,
    [product.optionGroups.length, product.variants, selectedIds],
  );

  const configurationComplete =
    !product.availability.requiresVariantSelection ||
    selectedIds.length === product.optionGroups.length;
  const stockQuantity = product.availability.requiresVariantSelection
    ? (selectedVariant?.stockQuantity ?? 0)
    : (product.availability.stockQuantity ?? 0);
  const purchasable =
    configurationComplete &&
    (selectedVariant?.inStock ?? product.availability.inStock) &&
    stockQuantity > 0;
  const displayedPrice = selectedVariant?.price ?? product.price;
  const displayedOriginalPrice =
    selectedVariant?.originalPrice ?? product.originalPrice;
  const displayedDiscount =
    selectedVariant?.discountPercent ?? product.discountPercent;

  useEffect(() => {
    if (restoredIntent.current) return;
    restoredIntent.current = true;

    const intent = readPendingCartIntent();
    if (!intent || intent.productId !== product.id) return;

    const variant = intent.variantId
      ? product.variants.find((item) => item.id === intent.variantId) ?? null
      : null;
    if (product.availability.requiresVariantSelection && !variant) return;

    const availableQuantity = variant?.stockQuantity ?? product.availability.stockQuantity ?? 1;
    const restoreTimer = window.setTimeout(() => {
      setSelectedValues(
        variant ? selectedValuesForVariant(product, variant) : {},
      );
      setQuantity(Math.min(intent.quantity, Math.max(1, availableQuantity)));
      setMessage(
        "Your previous selection was restored. Review it and select Add to cart again.",
      );
      onSelectedVariantChange(variant);
    }, 0);

    return () => window.clearTimeout(restoreTimer);
  }, [onSelectedVariantChange, product]);

  function isValueAvailable(groupId: string, valueId: string) {
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

  function selectValue(groupId: string, valueId: string) {
    const nextValues = { ...selectedValues };
    if (nextValues[groupId] === valueId) {
      delete nextValues[groupId];
    } else {
      nextValues[groupId] = valueId;
    }

    setSelectedValues(nextValues);
    setQuantity(1);
    setMessage(null);

    const ids = Object.values(nextValues);
    const variant =
      product.variants.find(
        (item) =>
          item.optionValueIds.length === product.optionGroups.length &&
          item.optionValueIds.every((id) => ids.includes(id)),
      ) ?? null;
    onSelectedVariantChange(variant);
  }

  async function addToCart() {
    if (!purchasable) {
      setMessage(
        configurationComplete
          ? "This selection is currently out of stock."
          : "Select every product option before continuing.",
      );
      return;
    }

    setMessage(null);
    setSubmitting(true);
    const intent: PendingCartIntent = {
      productId: product.id,
      variantId: selectedVariant?.id ?? null,
      quantity,
    };

    try {
      const settledAuth = auth.status === "loading" ? await refreshAuth() : auth;
      if (settledAuth.status !== "authenticated") {
        savePendingCartIntent(intent);
        router.push(`/login?next=${encodeURIComponent(`/products/${product.id}`)}`);
        return;
      }

      await addItem({
        product_id: intent.productId,
        variant_id: intent.variantId,
        quantity: intent.quantity,
      });
      sessionStorage.removeItem(pendingCartIntentKey);

      const choices = selectedVariant
        ? product.optionGroups
            .map((group) =>
              group.values.find((value) =>
                selectedVariant.optionValueIds.includes(value.id),
              )?.value,
            )
            .filter(Boolean)
            .join(" · ")
        : null;
      setMessage(
        `${product.title}${choices ? ` (${choices})` : ""} was added to your cart.`,
      );
    } catch (caught) {
      const error =
        caught instanceof ApiError
          ? caught
          : new ApiError(0, {
              message: "We could not add this item. Please try again.",
            });

      if (error.status === 401 || error.status === 419) {
        savePendingCartIntent(intent);
        router.push(`/login?next=${encodeURIComponent(`/products/${product.id}`)}`);
      } else if (error.status === 409) {
        setMessage(`Availability changed: ${error.message}`);
      } else if (error.status === 422) {
        setMessage(`Check your selection: ${error.message}`);
      } else if (error.status === 403) {
        setMessage("Your account cannot use the cart right now.");
      } else {
        setMessage(error.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function buyNow() {
    if (!purchasable) {
      setMessage(
        configurationComplete
          ? "This selection is currently out of stock."
          : "Select every product option before continuing.",
      );
      return;
    }

    const detail = {
      productId: product.id,
      variantId: selectedVariant?.id ?? null,
      quantity,
      intent: "buy_now",
    };
    window.dispatchEvent(
      new CustomEvent("aisley:product-purchase-intent", { detail }),
    );
    setMessage(
      "Buy Now is not available yet. Your selection has not been reserved.",
    );
  }

  return (
    <section aria-label="Product purchase options" className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        {product.badges.map((badge) => {
          const label = badgeLabels[badge];
          return label ? (
            <span key={badge} className="rounded-md bg-[#F0E5EC] px-2 py-1 text-xs font-semibold text-[#6D1748]">
              {label}
            </span>
          ) : null;
        })}
        {displayedDiscount ? (
          <span className="rounded-md bg-[#E6007A] px-2 py-1 text-xs font-bold text-white">
            {displayedDiscount}% off
          </span>
        ) : null}
      </div>

      <h1 className="mt-3 text-2xl font-semibold leading-tight text-[#241A28] sm:text-3xl">
        {product.title}
      </h1>
      {product.shortDescription ? (
        <p className="mt-3 text-sm leading-6 text-[#645969]">{product.shortDescription}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-y border-[#E8E2EA] py-4">
        <strong className="text-2xl text-[#E6007A] sm:text-[28px]">
          {moneyFormatter.format(displayedPrice)}
        </strong>
        {displayedOriginalPrice ? (
          <span className="text-sm text-[#8B808F] line-through">
            {moneyFormatter.format(displayedOriginalPrice)}
          </span>
        ) : null}
      </div>

      {product.optionGroups.map((group) => (
        <fieldset key={group.id} className="mt-5">
          <legend className="text-sm font-semibold text-[#302534]">{group.name}</legend>
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
                  onClick={() => selectValue(group.id, option.id)}
                  className={`relative min-h-10 rounded-md border px-3 py-2 text-sm font-medium focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A] disabled:cursor-not-allowed disabled:border-[#E3DDE5] disabled:bg-[#F4F1F5] disabled:text-[#A097A3] ${
                    selected
                      ? "border-[#E6007A] bg-[#FFF3F9] text-[#A10056]"
                      : "border-[#CFC6D2] bg-white text-[#3D3241] hover:border-[#8C7A91]"
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
                    {selected ? <HiCheck aria-hidden="true" className="size-4" /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-[#E8E2EA] pt-5">
        <div>
          <label htmlFor="product-quantity" className="text-sm font-semibold text-[#302534]">
            Quantity
          </label>
          <div className="mt-2 flex h-10 w-32 overflow-hidden rounded-md border border-[#CFC6D2] bg-white">
            <button
              type="button"
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
              disabled={quantity <= 1 || !purchasable}
              aria-label="Decrease quantity"
              className="grid w-10 place-items-center text-[#514656] hover:bg-[#F5F1F5] disabled:text-[#B3AAB6]"
            >
              <HiMinus aria-hidden="true" className="size-4" />
            </button>
            <input
              id="product-quantity"
              inputMode="numeric"
              pattern="[0-9]*"
              value={quantity}
              disabled={!purchasable}
              aria-describedby="product-stock"
              onChange={(event) => {
                const value = Number.parseInt(event.target.value, 10);
                setQuantity(Number.isNaN(value) ? 1 : Math.min(stockQuantity, Math.max(1, value)));
              }}
              className="min-w-0 flex-1 border-x border-[#E3DDE5] text-center text-sm outline-none disabled:bg-[#F4F1F5]"
            />
            <button
              type="button"
              onClick={() => setQuantity((value) => Math.min(stockQuantity, value + 1))}
              disabled={!purchasable || quantity >= stockQuantity}
              aria-label="Increase quantity"
              className="grid w-10 place-items-center text-[#514656] hover:bg-[#F5F1F5] disabled:text-[#B3AAB6]"
            >
              <HiPlus aria-hidden="true" className="size-4" />
            </button>
          </div>
        </div>
        <p id="product-stock" className="text-sm text-[#675B6B]">
          {!configurationComplete
            ? "Select all options to check stock"
            : stockQuantity > 0
              ? `${stockQuantity} available${selectedVariant ? ` · SKU ${selectedVariant.sku}` : ""}`
              : "Out of stock"}
        </p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={!purchasable || submitting}
          aria-busy={submitting}
          onClick={() => void addToCart()}
          className="flex min-h-12 items-center justify-center gap-2 rounded-md border border-[#E6007A] bg-white px-3 text-sm font-semibold text-[#C8006B] hover:bg-[#FFF3F9] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A] disabled:cursor-not-allowed disabled:border-[#D8D0DA] disabled:bg-[#F2EFF3] disabled:text-[#9A909D]"
        >
          <HiShoppingCart aria-hidden="true" className="size-5" />
          {submitting ? "Adding…" : "Add to cart"}
        </button>
        <button
          type="button"
          disabled={!purchasable}
          onClick={buyNow}
          className="min-h-12 rounded-md bg-[#E6007A] px-3 text-sm font-semibold text-white hover:bg-[#C8006B] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#4C1268] disabled:cursor-not-allowed disabled:bg-[#CFC6D2]"
        >
          Buy now
        </button>
      </div>

      <p aria-live="polite" role="status" className="mt-3 min-h-5 text-sm text-[#6D1748]">
        {message}
      </p>
      <p className="mt-1 text-xs leading-5 text-[#746978]">
        Price and stock are confirmed again when a purchase service accepts your request. Items are not reserved on this page.
      </p>
    </section>
  );
}
