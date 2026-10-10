import Image from "next/image";
import Link from "next/link";
import { FiMessageSquare, FiShoppingBag } from "react-icons/fi";
import type { ShopDetail } from "@/lib/marketplace/types";

export function ShopHeader({ shop }: { shop: ShopDetail }) {
  const description = shop.description?.trim();
  return (
    <header className="shop-identity">
      <div className="shop-banner">
        {shop.bannerUrl ? (
          <Image
            src={shop.bannerUrl}
            alt={`${shop.name} shop banner`}
            fill
            priority
            sizes="(max-width: 1280px) 100vw, 1280px"
            className="object-cover"
          />
        ) : (
          <div className="shop-banner-fallback">
            <FiShoppingBag aria-hidden="true" />
            <span>{shop.name}</span>
          </div>
        )}
      </div>
      <div className="shop-identity-content">
        <div className="shop-logo">
          {shop.logoUrl ? (
            <Image
              src={shop.logoUrl}
              alt={`${shop.name} logo`}
              fill
              sizes="80px"
              className="object-cover"
            />
          ) : (
            <span aria-hidden="true">{shop.name.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="shop-identity-copy">
          <h1 id="shop-page-heading" tabIndex={-1}>
            {shop.name}
          </h1>
          {shop.category && (
            <p className="shop-category">{shop.category.name}</p>
          )}
          {description &&
            (description.length > 240 ? (
              <details className="shop-description">
                <summary>About this shop</summary>
                <p>{description}</p>
              </details>
            ) : (
              <p className="shop-description">{description}</p>
            ))}
        </div>
        <Link
          className="shop-chat-button"
          href={`/messages/new?shop=${encodeURIComponent(shop.id)}`}
        >
          <FiMessageSquare aria-hidden="true" />
          Chat with Shop
        </Link>
      </div>
      <nav className="shop-section-navigation" aria-label="Shop sections">
        <a href="#vouchers">Vouchers</a>
        <a href="#shop-products-heading">Products</a>
      </nav>
    </header>
  );
}
