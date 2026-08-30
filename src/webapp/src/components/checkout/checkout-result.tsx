"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FiCheckCircle, FiMapPin, FiRefreshCw } from "react-icons/fi";

import { useAuth } from "@/components/auth/auth-provider";
import { ApiError } from "@/lib/api";
import { fetchCheckoutBatch } from "@/lib/checkout/client";
import type { CheckoutBatch } from "@/lib/checkout/types";

const money = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2,
});

function amount(value: string) {
  return money.format(Number(value));
}

function readableStatus(value: string) {
  return value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

export function CheckoutResult({ batchId }: { batchId: string }) {
  const router = useRouter();
  const { auth } = useAuth();
  const [batch, setBatch] = useState<CheckoutBatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (auth.status === "guest") {
      router.replace(`/login?next=${encodeURIComponent(`/checkout/result/${batchId}`)}`);
      return;
    }
    if (auth.status !== "authenticated") return;

    const controller = new AbortController();
    fetchCheckoutBatch(batchId, controller.signal)
      .then(setBatch)
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(caught instanceof ApiError ? caught.message : "We could not load this order confirmation.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [auth.status, batchId, router]);

  if (auth.status !== "authenticated" || loading) {
    return <div aria-label="Loading order confirmation" className="h-80 animate-pulse border border-[#DED7E1] bg-white" />;
  }

  if (error || !batch) {
    return (
      <div className="border border-[#DED7E1] bg-white px-5 py-12 text-center">
        <p role="alert" className="text-sm text-[#B42318]">{error ?? "Order confirmation not found."}</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md border border-[#CFC6D2] px-4 text-sm font-semibold text-[#4C1268]"><FiRefreshCw aria-hidden="true" />Try again</button>
      </div>
    );
  }

  return (
    <div>
      <div className="border border-[#C9DDCC] bg-[#F7FBF7] p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <FiCheckCircle aria-hidden="true" className="mt-0.5 size-7 shrink-0 text-[#3F6846]" />
          <div><h1 className="text-xl font-semibold text-[#263B2B] sm:text-2xl">Order placed</h1><p className="mt-1 text-sm leading-6 text-[#526457]">Your {batch.orders.length === 1 ? "order was" : `${batch.orders.length} Shop orders were`} placed together. Pay each Shop total in cash on delivery.</p><p className="mt-1 text-xs text-[#67776B]">Placed {new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(batch.placedAt))}</p></div>
        </div>
      </div>

      <div className="mt-5 space-y-5">
        {batch.orders.map((order) => (
          <article id={`order-${order.id}`} key={order.id} className="scroll-mt-32 border border-[#DED7E1] bg-white">
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E6E0E8] px-4 py-4 sm:px-5">
              <div><h2 className="font-semibold text-[#2D2231]">{order.shop.name}</h2><p className="mt-1 text-xs text-[#746978]">Order {order.reference}</p></div>
              <div className="text-right"><p className="text-sm font-semibold text-[#6D1748]">{readableStatus(order.status)}</p><p className="mt-1 text-xs text-[#746978]">COD · {readableStatus(order.paymentStatus)}</p><Link href={order.detailUrl} className="mt-2 inline-block text-xs font-semibold text-[#4C1268] hover:text-[#E6007A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]">View order</Link></div>
            </header>
            <div className="divide-y divide-[#EEE9EF]">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-4 px-4 py-4 text-sm sm:px-5"><div><p className="font-medium text-[#302534]">{item.productName}</p>{item.selectedOptions.length ? <p className="mt-1 text-xs text-[#746978]">{item.selectedOptions.map((option) => `${option.group}: ${option.value}`).join(" · ")}</p> : null}<p className="mt-1 text-xs text-[#887D8B]">Qty {item.quantity} · SKU {item.sku}</p></div><strong>{amount(item.lineSubtotal)}</strong></div>
              ))}
            </div>
            <div className="grid gap-5 border-t border-[#E6E0E8] px-4 py-4 sm:px-5 md:grid-cols-[minmax(0,1fr)_260px]">
              <div className="flex gap-2 text-sm text-[#665A6A]"><FiMapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><p><span className="font-medium text-[#3A2E3E]">{order.address.recipientName}</span><br />{order.address.addressLine1}, {order.address.barangay}, {order.address.cityMunicipality}, {order.address.province} {order.address.postalCode}</p></div>
              <dl className="space-y-2 text-sm"><div className="flex justify-between"><dt className="text-[#746978]">Merchandise</dt><dd>{amount(order.totals.merchandiseSubtotal)}</dd></div><div className="flex justify-between"><dt className="text-[#746978]">Shipping</dt><dd>{amount(order.totals.shippingFee)}</dd></div>{Number(order.totals.discount) > 0 ? <div className="flex justify-between text-[#3F6846]"><dt>Voucher discount</dt><dd>−{amount(order.totals.discount)}</dd></div> : null}{Number(order.totals.shippingDiscount) > 0 ? <div className="flex justify-between text-[#3F6846]"><dt>Shipping discount</dt><dd>−{amount(order.totals.shippingDiscount)}</dd></div> : null}<div className="flex justify-between border-t border-[#E6E0E8] pt-2 font-semibold"><dt>Total COD</dt><dd className="text-[#E6007A]">{amount(order.totals.payable)}</dd></div></dl>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-3"><Link href="/" className="rounded-md bg-[#E6007A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#C8006B]">Continue shopping</Link><Link href="/orders" className="rounded-md border border-[#CFC6D2] bg-white px-5 py-2.5 text-sm font-semibold text-[#4C1268]">View all orders</Link></div>
    </div>
  );
}
