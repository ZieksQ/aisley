"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FiHeart } from "react-icons/fi";

import { useAuth } from "@/components/auth/auth-provider";
import { ApiError } from "@/lib/api";

import { useWishlist } from "./wishlist-provider";

export function WishlistToggle({
  compact = false,
  onChange,
  productId,
}: {
  compact?: boolean;
  onChange?: (saved: boolean) => void;
  productId: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { auth, refresh } = useAuth();
  const { ensureStatus, isPending, isSaved, toggle } = useWishlist();
  const [message, setMessage] = useState("");
  const saved = isSaved(productId) ?? false;
  const pending = isPending(productId);

  useEffect(() => ensureStatus(productId), [ensureStatus, productId]);

  async function handleToggle() {
    setMessage("");
    const settledAuth = auth.status === "loading" ? await refresh() : auth;
    if (settledAuth.status !== "authenticated") {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    try {
      const next = await toggle(productId);
      setMessage(next ? "Added to Wishlist." : "Removed from Wishlist.");
      onChange?.(next);
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : "Wishlist could not be updated. Try again.");
    }
  }

  const label = saved ? "Remove from Wishlist" : "Add to Wishlist";

  return <div className={compact ? "" : "mt-3"}>
    <button
      aria-busy={pending}
      aria-label={label}
      aria-pressed={saved}
      className={compact
        ? "flex min-h-9 items-center gap-1.5 rounded-md border border-[#D8D0DA] bg-white/95 px-2.5 text-xs font-semibold text-[#4C1268] shadow-[0_1px_4px_rgba(49,18,63,0.1)] hover:border-[#B8AABD] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A] disabled:opacity-60"
        : "inline-flex min-h-10 items-center gap-2 rounded-md border border-[#CFC6D2] bg-white px-3 text-sm font-semibold text-[#4C1268] hover:bg-[#F7F1F8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A] disabled:opacity-60"}
      disabled={pending}
      onClick={() => void handleToggle()}
      type="button"
    >
      <FiHeart aria-hidden="true" className={`size-4 ${saved ? "fill-[#E6007A] text-[#E6007A]" : ""}`} />
      {pending ? "Updating…" : saved ? "Saved" : "Save"}
    </button>
    <span aria-live="polite" className="sr-only" role="status">{message}</span>
  </div>;
}
