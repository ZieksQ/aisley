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

  if (!segments?.length) {
    redirect("/account/profile");
  }

  return (
    <section className="border border-[#E2DCE4] bg-white p-6 sm:p-8">
      <h1 className="text-2xl font-semibold text-[#2E2332]">This account area is coming soon</h1>
      <p className="mt-3 text-sm leading-6 text-[#675B6B]">
        {auth.customer.displayName ?? "Your customer account"}, this section is not available yet. Profile and address management are ready from the account navigation.
      </p>
    </section>
  );
}
