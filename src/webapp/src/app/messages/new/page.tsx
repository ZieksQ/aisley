import { redirect } from "next/navigation";

export default async function StartConversationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const key of ["shop", "product", "order"]) if (typeof params[key] === "string") query.set(key, params[key]);
  redirect(`/messages?${query.toString()}`);
}
