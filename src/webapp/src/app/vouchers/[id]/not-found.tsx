import Link from "next/link";
export default function NotFound() {
  return (
    <section className="voucher-empty">
      <h1>Voucher unavailable</h1>
      <p>This offer is no longer publicly available.</p>
      <Link className="voucher-details-link" href="/vouchers">
        Discover other vouchers
      </Link>
    </section>
  );
}
