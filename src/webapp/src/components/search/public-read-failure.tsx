"use client";

import type { ReactNode } from "react";
import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@aisley/ui";
import type { PublicApiResult } from "@/lib/marketplace/server";

function subscribeOnline(change: () => void) {
  window.addEventListener("online", change);
  window.addEventListener("offline", change);
  return () => {
    window.removeEventListener("online", change);
    window.removeEventListener("offline", change);
  };
}

export function PublicReadFailure({ result, subject, children }: {
  result: Exclude<PublicApiResult<unknown>, { status: "success" }>;
  subject: string;
  children?: ReactNode;
}) {
  const router = useRouter();
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const [remaining, setRemaining] = useState(result.status === "throttled" ? result.retryAfter : 0);
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    if (!remaining) return;
    const timer = window.setTimeout(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [remaining]);

  const invalid = result.status === "invalid";
  const message = invalid ? result.message : !online ? "You are offline. Reconnect before trying again."
    : result.status === "throttled" ? "Too many requests. Wait before trying again."
    : result.status === "timeout" ? "The request timed out. Your filters have been kept."
    : "The service could not be reached. Your filters have been kept.";
  return (
    <section className="rounded-lg border border-[#E2DCE4] bg-white px-5 py-7" aria-label={`${subject} feedback`}>
      <h2 className="font-semibold text-[#3E3242]">
        {invalid ? "Check your search or filters" : `${subject} temporarily unavailable`}
      </h2>
      <p className="mt-2 break-words text-sm text-[#726776]" role="alert">{message}</p>
      {!invalid && (
        <Button
          variant="secondary"
          disabled={pending || remaining > 0 || !online}
          onClick={() => startTransition(() => router.refresh())}
          className="mt-4 min-h-11! rounded-lg! bg-[#4C1268] px-4 py-2 text-sm text-white shadow-none! focus-visible:outline-solid! focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-[#E6007A]!"
        >
          {pending ? "Trying again…" : remaining > 0 ? `Try again in ${remaining}s` : "Try again"}
        </Button>
      )}
      {children && <div className="mt-4 flex flex-wrap gap-4">{children}</div>}
    </section>
  );
}
