import Link from "next/link";
import type { Pagination } from "@/lib/marketplace/types";
import { filterParameters } from "@/lib/vouchers/model";
import type { VoucherFilters } from "@/lib/vouchers/types";

export function VoucherPagination({
  pagination,
  filters,
  base = "/vouchers",
  onPage,
}: {
  pagination: Pagination;
  filters?: VoucherFilters;
  base?: string;
  onPage?: (page: number) => void;
}) {
  if (pagination.lastPage <= 1 && pagination.currentPage <= 1) return null;
  const href = (page: number) =>
    `${base}?${filterParameters({ ...filters, page })}`;
  return (
    <nav className="voucher-pagination" aria-label="Voucher pages">
      {pagination.currentPage > 1 &&
        (onPage ? (
          <button onClick={() => onPage(pagination.currentPage - 1)}>
            Previous
          </button>
        ) : (
          <Link href={href(pagination.currentPage - 1)}>Previous</Link>
        ))}
      <span>
        Page {pagination.currentPage} of {pagination.lastPage}
      </span>
      {pagination.currentPage < pagination.lastPage &&
        (onPage ? (
          <button onClick={() => onPage(pagination.currentPage + 1)}>
            Next
          </button>
        ) : (
          <Link href={href(pagination.currentPage + 1)}>Next</Link>
        ))}
    </nav>
  );
}
