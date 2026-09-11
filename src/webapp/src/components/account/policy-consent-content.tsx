"use client";

import { Button } from "@aisley/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FiCheckCircle, FiRefreshCw, FiShield } from "react-icons/fi";

import { ApiError } from "@/lib/api";
import {
  acceptPolicy,
  fetchCurrentPolicy,
  fetchPolicyConsentStatus,
} from "@/lib/policies/client";
import type {
  PolicyConsentItem,
  PolicyVersion,
  PublicPolicyType,
} from "@/lib/policies/types";

type DocumentMap = Partial<Record<PublicPolicyType, PolicyVersion>>;

const policyOrder: PublicPolicyType[] = ["terms_of_service", "privacy_policy"];

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(new Date(value))
    : "Publication date unavailable";
}

function messageFor(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export function PolicyConsentContent() {
  const [policies, setPolicies] = useState<PolicyConsentItem[]>([]);
  const [documents, setDocuments] = useState<DocumentMap>({});
  const [checked, setChecked] = useState<Partial<Record<PublicPolicyType, boolean>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<PublicPolicyType | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetchPolicyConsentStatus(signal);
      const nextPolicies = policyOrder
        .map((type) => response.data.policies.find((policy) => policy.type === type))
        .filter((policy): policy is PolicyConsentItem => Boolean(policy));
      const entries = await Promise.all(
        nextPolicies
          .filter((policy) => policy.current_version)
          .map(async (policy) => [policy.type, (await fetchCurrentPolicy(policy.type, signal)).data.version] as const),
      );
      setPolicies(nextPolicies);
      setDocuments(Object.fromEntries(entries));
      setChecked({});
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(messageFor(caught, "We could not load your policy consent status. Check your connection and try again."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => { void load(controller.signal); }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load]);

  async function accept(type: PublicPolicyType, version: number) {
    setBusy(type);
    setError("");
    setMessage("");
    try {
      await acceptPolicy(type, version);
      setMessage(`${type === "terms_of_service" ? "Terms of Service" : "Privacy Policy"} accepted.`);
      await load();
    } catch (caught) {
      setError(messageFor(caught, "We could not record your acceptance. Refresh and try again."));
    } finally {
      setBusy(null);
    }
  }

  const pendingCount = useMemo(() => policies.filter((policy) => policy.required).length, [policies]);

  if (loading) {
    return <div aria-label="Loading policy consent" className="space-y-4"><div className="h-28 animate-pulse border border-[#E2DCE4] bg-[#F3EFF4]" /><div className="h-80 animate-pulse border border-[#E2DCE4] bg-[#F3EFF4]" /></div>;
  }

  if (error && policies.length === 0) {
    return <section className="border border-[#E2DCE4] bg-white p-5 sm:p-6"><p className="text-sm text-[#B42318]" role="alert">{error}</p><Button className="mt-4 min-h-10 rounded-md px-4" onClick={() => void load()} type="button" variant="outline"><FiRefreshCw aria-hidden="true" /> Try again</Button></section>;
  }

  return <div>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-semibold text-[#281E2C]">Policy consent</h1><p className="mt-1 text-sm leading-6 text-[#675B6B]">Review the same current Terms of Service and Privacy Policy used across Aisley.</p></div>
      <span className="inline-flex items-center gap-2 rounded-md bg-[#F4EDF6] px-3 py-1.5 text-xs font-semibold text-[#4C1268]"><FiShield aria-hidden="true" />{pendingCount ? `${pendingCount} review${pendingCount === 1 ? "" : "s"} pending` : "Up to date"}</span>
    </div>
    {message ? <p className="mt-4 border-l-2 border-[#3F6846] bg-[#F3F8F4] px-3 py-2 text-sm text-[#315637]" role="status"><FiCheckCircle aria-hidden="true" className="mr-2 inline" />{message}</p> : null}
    {error ? <p className="mt-4 border-l-2 border-[#B42318] bg-[#FFF4F2] px-3 py-2 text-sm text-[#9A271E]" role="alert">{error}</p> : null}
    <div className="mt-5 space-y-5">
      {policies.map((policy) => {
        const version = documents[policy.type];
        const needsAcceptance = policy.required && Boolean(version);
        return <article className="border border-[#DED7E1] bg-white p-5 sm:p-6" key={policy.type}>
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#EEE9EF] pb-4"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6D1748]">Shared platform policy</p><h2 className="mt-1 text-lg font-semibold text-[#302534]">{policy.label}</h2>{policy.current_version ? <p className="mt-1 text-sm text-[#746978]">Version {policy.current_version.version} · Published {formatDate(policy.current_version.published_at)}</p> : null}</div><span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${policy.required ? "bg-[#FFF4E5] text-[#8A4B00]" : "bg-[#F3F8F4] text-[#315637]"}`}>{policy.required ? "Action required" : policy.accepted ? "Accepted" : "No action required"}</span></div>
          {!version ? <p className="mt-5 text-sm text-[#746978]">No published version is available yet.</p> : <><div className="mt-5 whitespace-pre-wrap break-words text-sm leading-7 text-[#3E3242]">{version.content}</div>{policy.current_version?.change_summary ? <p className="mt-5 border-l-2 border-[#E6007A] bg-[#FFF6FA] px-3 py-2 text-sm leading-6 text-[#5D435C]"><strong>What changed:</strong> {policy.current_version.change_summary}</p> : null}<div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#EEE9EF] pt-4"><a className="text-sm font-semibold text-[#4C1268] hover:text-[#E6007A]" href={`/policies/${policy.type}/history`} target="_blank" rel="noreferrer">View published history</a>{needsAcceptance ? <div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-sm text-[#514656]"><input checked={Boolean(checked[policy.type])} className="size-4 accent-[#4C1268]" onChange={(event) => setChecked((current) => ({ ...current, [policy.type]: event.target.checked }))} type="checkbox" />I have read and agree to this version.</label><Button className="min-h-10 rounded-md px-4" disabled={!checked[policy.type] || busy !== null} onClick={() => void accept(policy.type, version.version)} type="button">{busy === policy.type ? "Saving…" : "Accept version"}</Button></div> : <p className="text-sm text-[#746978]">{policy.accepted_at ? `Accepted ${formatDate(policy.accepted_at)}.` : "Your previous acceptance covers this version."}</p>}</div></>}
        </article>;
      })}
    </div>
  </div>;
}
