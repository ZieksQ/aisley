import Link from "next/link";
import type { VoucherFilters } from "@/lib/vouchers/types";
import { filterParameters } from "@/lib/vouchers/model";

export function VoucherFiltersBar({ filters }: { filters: VoucherFilters }) {
  return (
    <div className="voucher-filters">
      <nav aria-label="Voucher issuer" className="voucher-filter-tabs">
        {(
          [
            [undefined, "All"],
            ["app", "Platform"],
            ["shop", "Shop"],
          ] as const
        ).map(([issuer, label]) => {
          const parameters = filterParameters({
            ...filters,
            page: undefined,
            issuer,
          });
          return (
            <Link
              key={label}
              href={`/vouchers${parameters.size ? `?${parameters}` : ""}`}
              aria-current={filters.issuer === issuer ? "page" : undefined}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      <form action="/vouchers" className="voucher-benefit-filter">
        {filters.issuer && (
          <input type="hidden" name="issuer" value={filters.issuer} />
        )}
        <label htmlFor="voucher-benefit">Benefit</label>
        <select
          id="voucher-benefit"
          name="benefit"
          defaultValue={filters.benefit ?? ""}
        >
          <option value="">All benefits</option>
          <option value="discount">Merchandise discount</option>
          <option value="shipping">Shipping saving</option>
        </select>
        <button type="submit">Apply</button>
      </form>
    </div>
  );
}
