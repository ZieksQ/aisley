import { redirect } from "next/navigation";

export default async function LegacyMessagesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (typeof value === "string") next.set(key, value);
  next.set("kind", "customer_logistics");
  redirect(`/messages?${next}`);
}
