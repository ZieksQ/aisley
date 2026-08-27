import { AuthShell } from "@/components/auth/auth-shell";

export default function CustomerAuthLayout({ children }: LayoutProps<"/">) {
  return <AuthShell>{children}</AuthShell>;
}
