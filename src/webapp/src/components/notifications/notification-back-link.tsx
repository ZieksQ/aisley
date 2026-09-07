import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";

export function NotificationBackLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-10 items-center gap-2 rounded-md px-1 text-sm font-semibold text-[#4C1268] hover:text-[#E6007A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]"
    >
      <FiArrowLeft aria-hidden="true" className="size-4" />
      {label}
    </Link>
  );
}
