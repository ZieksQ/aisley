import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FiShield, FiUser } from "react-icons/fi";

import { getServerAuthState } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: "Profile",
  description: "Review your Aisley customer identity and account status.",
  robots: { index: false, follow: false },
};

export default async function CustomerProfilePage() {
  const auth = await getServerAuthState();
  if (auth.status !== "authenticated") {
    redirect(`/login?next=${encodeURIComponent("/account/profile")}`);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[#281E2C]">Profile</h1>
      <p className="mt-1 text-sm leading-6 text-[#675B6B]">Your customer identity used across orders and account pages.</p>

      <section className="mt-5 border border-[#DED7E1] bg-white p-5 sm:p-6" aria-label="Customer profile details">
        <dl className="divide-y divide-[#E9E4EB]">
          <div className="grid gap-2 py-4 first:pt-0 sm:grid-cols-[180px_1fr]">
            <dt className="flex items-center gap-2 text-sm font-medium text-[#746978]"><FiUser aria-hidden="true" /> Name</dt>
            <dd className="text-sm font-semibold text-[#302534]">{auth.customer.displayName ?? "Not provided"}</dd>
          </div>
          <div className="grid gap-2 py-4 last:pb-0 sm:grid-cols-[180px_1fr]">
            <dt className="flex items-center gap-2 text-sm font-medium text-[#746978]"><FiShield aria-hidden="true" /> Account status</dt>
            <dd className="text-sm font-semibold text-[#3F6846]">Active</dd>
          </div>
        </dl>
      </section>

      <p className="mt-4 text-sm leading-6 text-[#746978]">
        Profile editing is not available yet. Address details are managed separately from the Addresses section.
      </p>
    </div>
  );
}
