import type { ReactNode } from "react";
import { CheckoutProvider } from "@/components/checkout/checkout-provider";

export default function CheckoutReviewLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <CheckoutProvider>{children}</CheckoutProvider>;
}
