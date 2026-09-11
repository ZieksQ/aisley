import type { Metadata } from "next";
import Link from "next/link";

import { PolicyError, PolicyNotFound, PolicyPageShell } from "@/components/policies/policy-page-shell";
import { getPublicPolicyHistory, isPublicPolicyType, policyLabel, policyPath } from "@/lib/policies/server";

type PolicyHistoryPageProps = { params: Promise<{ type: string }> };

export async function generateMetadata({ params }: PolicyHistoryPageProps): Promise<Metadata> {
  const { type } = await params;
  const label = isPublicPolicyType(type) ? policyLabel(type) : "Platform policy";
  return { title: `${label} history`, description: `View published versions of the Aisley ${label}.` };
}

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(new Date(value)) : "Date unavailable";
}

export default async function PolicyHistoryPage({ params }: PolicyHistoryPageProps) {
  const { type } = await params;
  if (!isPublicPolicyType(type)) return <PolicyNotFound href="/" />;
  const history = await getPublicPolicyHistory(type);

  return <PolicyPageShell><nav aria-label="Breadcrumb" className="mb-5 text-sm text-[#726776]"><Link className="hover:text-[#E6007A] focus-visible:outline-2 focus-visible:outline-[#E6007A]" href={policyPath(type)}>Current {policyLabel(type)}</Link><span aria-hidden="true" className="mx-2">/</span><span aria-current="page">History</span></nav>{history.status === "error" ? <PolicyError href={`${policyPath(type)}/history`} /> : history.status === "not_found" ? <PolicyNotFound href={policyPath(type)} /> : <section className="border border-[#DED7E1] bg-white px-5 py-6 sm:px-8 sm:py-8"><h1 className="text-2xl font-bold text-[#2A1C2E]">{policyLabel(type)} history</h1><p className="mt-2 text-sm leading-6 text-[#6B5F6F]">Published and superseded versions are preserved for reference. Drafts are not shown.</p>{history.data.data.versions.length === 0 ? <p className="mt-8 border border-dashed border-[#D8D0DA] px-5 py-10 text-center text-sm text-[#746978]">No published history is available.</p> : <ol className="mt-6 divide-y divide-[#EEE9EF] border-y border-[#EEE9EF]">{history.data.data.versions.map((version) => <li className="flex flex-wrap items-center justify-between gap-4 py-5" key={version.id}><div><p className="font-semibold text-[#3E3242]">Version {version.version}: {version.title}</p><p className="mt-1 text-sm text-[#746978]">{version.status === "superseded" ? "Superseded" : "Published"} · {formatDate(version.published_at)}</p>{version.change_summary ? <p className="mt-2 text-sm leading-6 text-[#5D435C]">{version.change_summary}</p> : null}</div><Link className="inline-flex min-h-10 items-center rounded-md border border-[#CFC4D2] px-3 text-sm font-semibold text-[#4C1268] hover:bg-[#F7F1F8] focus-visible:outline-2 focus-visible:outline-[#E6007A]" href={`${policyPath(type)}/history/${version.version}`}>Read exact version</Link></li>)}</ol>}</section>}</PolicyPageShell>;
}
