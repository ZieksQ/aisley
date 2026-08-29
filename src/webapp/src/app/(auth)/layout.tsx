import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { getServerAuthState } from "@/lib/auth/server";

export default async function CustomerAuthLayout({
  children,
}: LayoutProps<"/">) {
  const auth = await getServerAuthState();

  if (auth.status === "authenticated") {
    redirect("/");
  }

  return <AuthShell>{children}</AuthShell>;
}
