"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FiHeart, FiRefreshCw, FiShoppingCart } from "react-icons/fi";

import { useCart } from "@/components/cart/cart-provider";
import { ProductCard } from "@/components/marketplace/product-card";
import { useWishlist } from "@/components/wishlist/wishlist-provider";
import { ApiError } from "@/lib/api";
import { fetchWishlist } from "@/lib/wishlist/client";
import type { WishlistItem } from "@/lib/wishlist/types";

export function WishlistPageContent() {
  const { addItem } = useCart();
  const { isSaved, reconcile } = useWishlist();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [message, setMessage] = useState("");
  const [pendingCartId, setPendingCartId] = useState<string | null>(null);

  async function load(cursor?: string) {
    const page = await fetchWishlist(cursor);
    setItems((current) => cursor ? [...current, ...page.data] : page.data);
    setNextCursor(page.meta.next_cursor);
    reconcile(Object.fromEntries(page.data.map((item) => [item.product.id, true])));
  }

  useEffect(() => {
    const controller = new AbortController();
    fetchWishlist(undefined, controller.signal)
      .then((page) => {
        setItems(page.data);
        setNextCursor(page.meta.next_cursor);
        reconcile(Object.fromEntries(page.data.map((item) => [item.product.id, true])));
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("error");
      });
    return () => controller.abort();
  }, [reconcile]);

  if (status === "loading") return <WishlistLoading />;

  if (status === "error") {
    return <div className="border border-[#DED7E1] bg-white px-5 py-10 text-center">
      <p className="text-sm text-[#594D5D]">We could not load your Wishlist.</p>
      <button className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md border border-[#CFC6D2] px-4 text-sm font-semibold text-[#4C1268] hover:bg-[#F6F0F8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]" onClick={async () => { setStatus("loading"); try { await load(); setStatus("ready") } catch { setStatus("error") } }} type="button"><FiRefreshCw aria-hidden="true" />Try again</button>
    </div>;
  }

  const visibleItems = items.filter((item) => isSaved(item.product.id) !== false);

  if (visibleItems.length === 0) {
    return <div className="border border-[#DED7E1] bg-white px-5 py-12 text-center"><FiHeart aria-hidden="true" className="mx-auto size-10 text-[#8B7D90]" /><h1 className="mt-4 text-xl font-semibold text-[#2D2231]">Your Wishlist is empty</h1><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6B5F6F]">Save products you want to find again without adding them to your Cart.</p><Link className="mt-5 inline-flex min-h-10 items-center rounded-md bg-[#E6007A] px-4 text-sm font-semibold text-white hover:bg-[#C8006B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4C1268]" href="/">Browse products</Link></div>;
  }

  return <div>
    <div className="flex items-end justify-between gap-4 border-b border-[#DED7E1] pb-4"><div><h1 className="text-2xl font-semibold text-[#281E2C]">Wishlist</h1><p className="mt-1 text-sm text-[#675B6B]">{visibleItems.length} saved {visibleItems.length === 1 ? "product" : "products"}</p></div></div>
    <p aria-live="polite" className="mt-3 min-h-5 text-sm text-[#6D1748]" role="status">{message}</p>
    <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {visibleItems.map((item, index) => <div className="flex min-w-0 flex-col" key={item.id}><ProductCard onWishlistChange={(saved) => { if (!saved) setItems((current) => current.filter((entry) => entry.id !== item.id)) }} position={index + 1} product={item.product} section="customer_wishlist" />{item.product.requiresVariantSelection ? <Link className="mt-2 flex min-h-10 items-center justify-center rounded-md border border-[#CFC6D2] bg-white px-3 text-sm font-semibold text-[#4C1268] hover:bg-[#F7F1F8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]" href={`/products/${item.product.id}`}>Choose options</Link> : <button className="mt-2 flex min-h-10 items-center justify-center gap-2 rounded-md border border-[#E6007A] bg-white px-3 text-sm font-semibold text-[#C8006B] hover:bg-[#FFF3F9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A] disabled:cursor-not-allowed disabled:border-[#D8D0DA] disabled:text-[#9A909D]" disabled={item.product.stockStatus === "out_of_stock" || pendingCartId === item.product.id} onClick={async () => { setPendingCartId(item.product.id); setMessage(""); try { await addItem({ product_id: item.product.id, variant_id: null, quantity: 1 }); setMessage(`${item.product.title} was added to your Cart.`) } catch (caught) { setMessage(caught instanceof ApiError ? caught.message : "This product could not be added to your Cart.") } finally { setPendingCartId(null) } }} type="button"><FiShoppingCart aria-hidden="true" />{pendingCartId === item.product.id ? "Adding…" : item.product.stockStatus === "out_of_stock" ? "Out of stock" : "Add to Cart"}</button>}</div>)}
    </div>
    {nextCursor ? <div className="mt-7 text-center"><button className="min-h-10 rounded-md border border-[#CFC6D2] bg-white px-4 text-sm font-semibold text-[#4C1268] hover:bg-[#F7F1F8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A] disabled:opacity-60" disabled={loadingMore} onClick={async () => { setLoadingMore(true); try { await load(nextCursor) } catch { setMessage("More saved products could not be loaded. Try again.") } finally { setLoadingMore(false) } }} type="button">{loadingMore ? "Loading…" : "Load more"}</button></div> : null}
  </div>;
}

function WishlistLoading() {
  return <div aria-label="Loading Wishlist"><div className="h-8 w-32 animate-pulse bg-[#E9E4EB]" /><div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{[0, 1, 2, 3].map((item) => <div className="aspect-[3/4] animate-pulse border border-[#DED7E1] bg-white" key={item} />)}</div></div>;
}
