import { RegisterForm } from "@/components/auth/register-form";
import type { ReactNode } from "react";

export default function RegistrationLayout({ children }: { children: ReactNode }) {
  return <section className="w-full max-w-2xl">
    <RegisterForm />
    {children}
  </section>;
}
