import { AuthShell } from "@/components/auth/auth-shell";
import { AuthRouteBoundary } from "@/components/auth/auth-route-boundary";

export default function CustomerAuthLayout({ children }: LayoutProps<"/">) {
  return <AuthShell><AuthRouteBoundary guestOnly>{children}</AuthRouteBoundary></AuthShell>;
}
