import type { ReactNode } from "react";
import { FiAlertCircle, FiCheckCircle } from "react-icons/fi";

export function FormAlert({
  children,
  tone = "error",
}: {
  children: ReactNode;
  tone?: "error" | "success";
}) {
  const success = tone === "success";

  return (
    <div
      role={success ? "status" : "alert"}
      className={`flex gap-3 rounded-xl border px-4 py-3 text-sm leading-6 ${
        success
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-[#A51D18]"
      }`}
    >
      {success ? (
        <FiCheckCircle aria-hidden="true" className="mt-1 size-4 shrink-0" />
      ) : (
        <FiAlertCircle aria-hidden="true" className="mt-1 size-4 shrink-0" />
      )}
      <div>{children}</div>
    </div>
  );
}
