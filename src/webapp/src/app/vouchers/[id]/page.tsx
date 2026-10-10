import type { Metadata } from "next";
import Link from "next/link";
import { PrivateVoucherDetail } from "@/components/vouchers/private-voucher-detail";
import { PublicReadFailure } from "@/components/search/public-read-failure";
import { VoucherOffers } from "@/components/vouchers/voucher-offers";
import { publicVoucher } from "@/lib/vouchers/server";

type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const result = await publicVoucher(id);
  if (result.status !== "success")
    return { title: "Voucher unavailable", robots: { index: false } };
  const title = result.data.name;
  const description =
    result.data.termsSummary?.slice(0, 160) ||
    "View voucher conditions and collection availability on Aisley.";
  return {
    title,
    description,
    alternates: { canonical: `/vouchers/${id}` },
    openGraph: { title, description, url: `/vouchers/${id}` },
    twitter: { card: "summary", title, description },
  };
}

export default async function VoucherDetailPage({ params }: Props) {
  const { id } = await params;
  const result = await publicVoucher(id);
  if (result.status === "not_found")
    return <PrivateVoucherDetail key={id} id={id} />;
  return (
    <>
      <nav aria-label="Breadcrumb" className="voucher-breadcrumb">
        <Link href="/">Home</Link>
        <span aria-hidden="true">/</span>
        <Link href="/vouchers">Vouchers</Link>
      </nav>
      {result.status === "success" ? (
        <>
          <header className="voucher-page-heading">
            <h1>{result.data.name}</h1>
          </header>
          <VoucherOffers items={[result.data]} detail />
        </>
      ) : (
        <PublicReadFailure result={result} subject="Voucher" />
      )}
    </>
  );
}
