import Image from "next/image";
import Link from "next/link";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import { HiArrowTopRightOnSquare, HiStar } from "react-icons/hi2";
import remarkGfm from "remark-gfm";

import type { ProductDetail } from "@/lib/marketplace/types";

function safeMarkdownUrl(url: string) {
  return defaultUrlTransform(url);
}

export function ShopSummary({ shop }: { shop: ProductDetail["shop"] }) {
  return (
    <section aria-labelledby="shop-heading" className="flex flex-wrap items-center justify-between gap-4 border-y border-[#E3DDE5] py-5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative size-12 shrink-0 overflow-hidden rounded-md border border-[#DED7E1] bg-[#F2EEF3]">
          {shop.logoUrl ? (
            <Image src={shop.logoUrl} alt={`${shop.name} logo`} fill sizes="48px" className="object-cover" />
          ) : (
            <span aria-hidden="true" className="grid h-full place-items-center text-lg font-semibold text-[#6A5E6E]">
              {shop.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <h2 id="shop-heading" className="truncate text-base font-semibold text-[#2D2231]">{shop.name}</h2>
          <p className="mt-0.5 text-sm text-[#746978]">Seller storefront</p>
        </div>
      </div>
      <Link
        href={shop.storefrontUrl}
        className="rounded-md border border-[#BDAFC2] bg-white px-4 py-2 text-sm font-semibold text-[#4C1268] hover:border-[#7C6684] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]"
      >
        Visit shop
      </Link>
    </section>
  );
}

export function ProductDescription({ markdown }: { markdown: string | null }) {
  return (
    <section aria-labelledby="description-heading">
      <h2 id="description-heading" className="text-xl font-semibold text-[#2D2231]">Product description</h2>
      {markdown ? (
        <div className="mt-4 text-[15px] leading-7 text-[#4F4453] [&_blockquote]:border-l-2 [&_blockquote]:border-[#C9BBCD] [&_blockquote]:pl-4 [&_h1]:mb-3 [&_h1]:mt-6 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:font-semibold [&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_strong]:font-semibold [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-[#DED7E1] [&_td]:p-2 [&_th]:border [&_th]:border-[#DED7E1] [&_th]:bg-[#F2EEF3] [&_th]:p-2 [&_th]:text-left [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            urlTransform={safeMarkdownUrl}
            components={{
              a: ({ href, children, ...props }) => {
                const external = Boolean(href && /^(https?:)?\/\//i.test(href));
                return (
                  <a
                    {...props}
                    href={href}
                    target={external ? "_blank" : undefined}
                    rel={external ? "noopener noreferrer" : undefined}
                    className="font-medium text-[#B0005E] underline decoration-[#D89AB9] underline-offset-2 hover:text-[#790041] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]"
                  >
                    {children}
                    {external ? <HiArrowTopRightOnSquare aria-hidden="true" className="ml-1 inline size-3.5" /> : null}
                  </a>
                );
              },
            }}
          >
            {markdown}
          </ReactMarkdown>
        </div>
      ) : (
        <p className="mt-3 text-sm text-[#746978]">The seller has not added a full description yet.</p>
      )}
    </section>
  );
}

export function ProductSpecifications({ specifications }: { specifications: ProductDetail["specifications"] }) {
  const entries = specifications ? Object.entries(specifications) : [];
  if (entries.length === 0) return null;

  return (
    <section aria-labelledby="specifications-heading">
      <h2 id="specifications-heading" className="text-xl font-semibold text-[#2D2231]">Specifications</h2>
      <dl className="mt-4 divide-y divide-[#E8E2EA] border-y border-[#E8E2EA]">
        {entries.map(([label, value]) => (
          <div key={label} className="grid gap-1 py-3 text-sm sm:grid-cols-[minmax(140px,0.35fr)_1fr] sm:gap-5">
            <dt className="font-medium text-[#675B6B]">{label}</dt>
            <dd className="text-[#302534]">{value === null ? "—" : String(value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function RatingSummary({ averageRating, reviewCount, soldCount }: Pick<ProductDetail, "averageRating" | "reviewCount" | "soldCount">) {
  return (
    <section aria-labelledby="reviews-heading">
      <h2 id="reviews-heading" className="text-xl font-semibold text-[#2D2231]">Reviews</h2>
      {reviewCount > 0 && averageRating !== null ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <strong className="text-3xl text-[#2D2231]">{averageRating.toFixed(1)}</strong>
          <div>
            <div className="flex gap-0.5 text-[#FF8800]" aria-label={`${averageRating.toFixed(1)} out of 5 stars`}>
              {Array.from({ length: 5 }, (_, index) => (
                <HiStar key={index} aria-hidden="true" className={`size-5 ${index + 1 > Math.round(averageRating) ? "text-[#D8D0DA]" : ""}`} />
              ))}
            </div>
            <p className="mt-1 text-sm text-[#746978]">Based on {reviewCount.toLocaleString("en-PH")} reviews</p>
          </div>
        </div>
      ) : (
        <div className="mt-4 border-y border-[#E8E2EA] py-5">
          <p className="font-medium text-[#3D3241]">No reviews yet</p>
          <p className="mt-1 text-sm text-[#746978]">Verified-purchase reviews will appear here.</p>
        </div>
      )}
      {soldCount > 0 ? <p className="mt-3 text-sm text-[#675B6B]">{soldCount.toLocaleString("en-PH")} sold</p> : null}
    </section>
  );
}
