"use client";

import { useEffect, useState } from "react";
import { apiRequest, initializeCsrf } from "@/lib/api";

type Preference = {
  promotional_in_app_opted_in: boolean;
  promotional_in_app_opted_in_at: string | null;
};

const path = "/api/v1/customer/account/notification-preferences";

export function PromotionPreferenceSection() {
  const [saved, setSaved] = useState<Preference | null>(null);
  const [selected, setSelected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    apiRequest<{ data: Preference }>(path, { cache: "no-store" })
      .then(({ data }) => {
        if (active) { setSaved(data); setSelected(data.promotional_in_app_opted_in); setError(""); }
      })
      .catch(() => { if (active) setError("Notification preferences could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);

  async function save() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await initializeCsrf();
      const { data } = await apiRequest<{ data: Preference }>(path, {
        method: "PATCH",
        body: JSON.stringify({ promotional_in_app_opted_in: selected }),
      });
      setSaved(data);
      setSelected(data.promotional_in_app_opted_in);
      setNotice(data.promotional_in_app_opted_in ? "In-app promotional messages are on." : "In-app promotional messages are off.");
    } catch {
      setError("Your preference was not saved. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="promotion-preference-heading" className="mt-5 border border-[#DED7E1] bg-white p-5 sm:p-6">
      <h2 className="text-base font-semibold text-[#302534]" id="promotion-preference-heading">Notification preferences</h2>
      <p className="mt-1 text-sm leading-6 text-[#746978]">Order and account updates are separate from this optional setting.</p>
      {loading ? <p className="mt-4 text-sm text-[#746978]">Loading preference…</p> : saved ? <>
        <label className="mt-4 flex items-start gap-3 text-sm text-[#302534]">
          <input checked={selected} className="mt-1 size-4 accent-[#4C1268]" disabled={busy} onChange={(event) => { setSelected(event.target.checked); setNotice(""); }} type="checkbox" />
          <span>Send me promotional messages in my Aisley in-app inbox. This is off by default, and I can turn it off at any time.</span>
        </label>
        <button className="mt-4 rounded-md bg-[#4C1268] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={busy || saved.promotional_in_app_opted_in === selected} onClick={() => void save()} type="button">{busy ? "Saving…" : "Save preference"}</button>
      </> : null}
      {notice && <p className="mt-3 text-sm text-[#315637]" role="status">{notice}</p>}
      {error && <p className="mt-3 text-sm text-[#B42318]" role="alert">{error} <button className="underline" onClick={() => { setLoading(true); setRetry((value) => value + 1); }} type="button">Retry</button></p>}
    </section>
  );
}
