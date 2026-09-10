import type { Metadata } from "next";
import Link from "next/link";

import {
  PolicyError,
  PolicyNotFound,
  PolicyPageShell,
} from "@/components/policies/policy-page-shell";
import {
  getPublicPolicy,
  getPublicPolicyHistory,
  isPublicPolicyType,
  policyLabel,
  policyPath,
} from "@/lib/policies/server";
import type { PublicPolicyType } from "@/lib/policies/types";

type PolicyPageProps = { params: Promise<{ type: string }> };

export async function generateMetadata({ params }: PolicyPageProps): Promise<Metadata> {
  const { type } = await params;
  const label = isPublicPolicyType(type) ? policyLabel(type) : "Platform policy";

  return {
    title: label,
    description: `Read the current ${label} for Aisley.`,
    alternates: { canonical: `/policies/${type}` },
  };
}

function formatDate(value: string | null) {
  if (!value) return "Publication date unavailable";
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(new Date(value));
}

export default async function PolicyPage({ params }: PolicyPageProps) {
  const { type } = await params;
  if (!isPublicPolicyType(type)) return <PolicyNotFound href="/" />;
  const policyType: PublicPolicyType = type;
  const [current, history] = await Promise.all([getPublicPolicy(policyType), getPublicPolicyHistory(policyType)]);

  return <PolicyPageShell>
    <nav aria-label="Breadcrumb" className="mb-5 text-sm text-[#726776]"><Link className="hover:text-[#E6007A] focus-visible:outline-2 focus-visible:outline-[#E6007A]" href="/">Home</Link><span aria-hidden="true" className="mx-2">/</span><span aria-current="page">{policyLabel(policyType)}</span></nav>
    {current.status === "error" ? <PolicyError href={policyPath(policyType)} /> : current.status === "not_found" ? <PolicyNotFound href="/" /> : <article className="border border-[#DED7E1] bg-white px-5 py-6 sm:px-8 sm:py-8"><div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#EEE9EF] pb-5"><div><p className="text-sm font-medium text-[#6D1748]">Current published policy</p><h1 className="mt-2 text-2xl font-bold tracking-[-0.025em] text-[#2A1C2E] sm:text-3xl">{current.data.data.version.title}</h1><p className="mt-2 text-sm text-[#6B5F6F]">Version {current.data.data.version.version} · Published {formatDate(current.data.data.version.published_at)}</p></div><Link className="inline-flex min-h-10 items-center rounded-md border border-[#CFC4D2] px-3 text-sm font-semibold text-[#4C1268] hover:bg-[#F7F1F8] focus-visible:outline-2 focus-visible:outline-[#E6007A]" href={`${policyPath(policyType)}/history`}>View history</Link></div>{current.data.data.version.change_summary ? <p className="mt-5 border-l-2 border-[#E6007A] bg-[#FFF6FA] px-4 py-3 text-sm leading-6 text-[#5D435C]"><strong>What changed:</strong> {current.data.data.version.change_summary}</p> : null}<div className="mt-7 whitespace-pre-wrap break-words text-[15px] leading-8 text-[#3E3242]">{current.data.data.version.content}</div></article>}
    {history.status === "success" && history.data.data.versions.length > 0 ? <section className="mt-8" aria-labelledby="policy-history-heading"><div className="flex items-end justify-between gap-3"><h2 className="text-lg font-semibold text-[#2D2231]" id="policy-history-heading">Published history</h2><Link className="text-sm font-semibold text-[#4C1268] hover:text-[#E6007A]" href={`${policyPath(policyType)}/history`}>See all versions</Link></div><ul className="mt-3 divide-y divide-[#EEE9EF] border-y border-[#EEE9EF] bg-white">{history.data.data.versions.slice(0, 3).map((version) => <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-4" key={version.id}><div><p className="text-sm font-semibold text-[#3E3242]">Version {version.version}: {version.title}</p><p className="mt-1 text-xs text-[#746978]">{version.status === "superseded" ? "Superseded" : "Published"} · {formatDate(version.published_at)}</p></div><Link className="text-sm font-semibold text-[#4C1268] hover:text-[#E6007A]" href={`${policyPath(policyType)}/history/${version.version}`}>Read version</Link></li>)}</ul></section> : null}
  </PolicyPageShell>;
}
