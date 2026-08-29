import Link from "next/link";
import { redirect } from "next/navigation";

import { getServerAuthState } from "@/lib/auth/server";

function accountPath(segments: string[] | undefined) {
  return `/account${segments?.length ? `/${segments.join("/")}` : ""}`;
}

export default async function CustomerAccountPlaceholder({
  params,
}: {
  params: Promise<{ segments?: string[] }>;
}) {
  const { segments } = await params;
  const path = accountPath(segments);
  const auth = await getServerAuthState();

  if (auth.status !== "authenticated") {
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 items-center px-4 py-12 sm:px-5 lg:px-8">
      <section className="w-full border border-[#E2DCE4] bg-white p-6 sm:p-8">
        <p className="text-sm font-semibold text-[#4C1268]">{auth.customer.displayName ?? "Customer account"}</p>
        <h1 className="mt-2 text-2xl font-bold tracking-[-0.02em] text-[#2E2332]">This account area is coming soon</h1>
        <p className="mt-3 text-sm leading-6 text-[#675B6B]">
          Your customer session is protected. Profile, wishlist, and settings management will be available here in a future update.
        </p>
        <Link href="/" className="mt-6 inline-flex rounded-md bg-[#4C1268] px-4 py-2 text-sm font-semibold text-white hover:bg-[#38104D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]">
          Continue shopping
        </Link>
      </section>
    </main>
  );
}
