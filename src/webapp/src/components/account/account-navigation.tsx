"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FiHeart, FiMapPin, FiPackage, FiUser } from "react-icons/fi";

const entries = [
  { href: "/account/profile", label: "Profile", icon: FiUser },
  { href: "/account/addresses", label: "Addresses", icon: FiMapPin },
  { href: "/account/wishlist", label: "Wishlist", icon: FiHeart },
  { href: "/orders", label: "Orders", icon: FiPackage },
];

export function AccountNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Customer account" className="border border-[#DED7E1] bg-white p-2 lg:sticky lg:top-28">
      <ul className="flex gap-1 overflow-x-auto lg:block lg:space-y-1">
        {entries.map((entry) => {
          const active = pathname === entry.href;
          const Icon = entry.icon;
          return (
            <li key={entry.href} className="shrink-0">
              <Link
                href={entry.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors ${active ? "bg-[#F4EDF6] text-[#4C1268]" : "text-[#514656] hover:bg-[#F8F5F8] hover:text-[#4C1268]"}`}
              >
                <Icon aria-hidden="true" className="size-4" />
                {entry.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
