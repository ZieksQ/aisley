import type { Metadata } from "next";
import Link from "next/link";

import { PolicyError, PolicyNotFound, PolicyPageShell } from "@/components/policies/policy-page-shell";
import { getPublicPolicyHistoryVersion, isPublicPolicyType, policyLabel, policyPath } from "@/lib/policies/server";

type PolicyVersionPageProps = { params: Promise<{ type: string; version: string }> };

export async function generateMetadata({ params }: PolicyVersionPageProps): Promise<Metadata> {
  const { type, version } = await params;
  const label = isPublicPolicyType(type) ? policyLabel(type) : "Platform policy";
  return { title: `${label} version ${version}`, description: `Read exact published version ${version} of the Aisley ${label}.` };
}

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(new Date(value)) : "Date unavailable";
}

export default async function PolicyVersionPage({ params }: PolicyVersionPageProps) {
  const { type, version: rawVersion } = await params;
  if (!isPublicPolicyType(type)) return <PolicyNotFound href="/" />;
  const version = Number(rawVersion);
  if (!Number.isSafeInteger(version) || version < 1 || version > 10_000) return <PolicyNotFound href={policyPath(type)} />;
  const result = await getPublicPolicyHistoryVersion(type, version);

  return <PolicyPageShell><nav aria-label="Breadcrumb" className="mb-5 text-sm text-[#726776]"><Link className="hover:text-[#E6007A] focus-visible:outline-2 focus-visible:outline-[#E6007A]" href={`${policyPath(type)}/history`}>{policyLabel(type)} history</Link><span aria-hidden="true" className="mx-2">/</span><span aria-current="page">Version {version}</span></nav>{result.status === "error" ? <PolicyError href={`${policyPath(type)}/history/${version}`} /> : result.status === "not_found" ? <PolicyNotFound href={policyPath(type)} /> : <article className="border border-[#DED7E1] bg-white px-5 py-6 sm:px-8 sm:py-8"><div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#EEE9EF] pb-5"><div><p className="text-sm font-medium text-[#6D1748]">Historical {policyLabel(type)}</p><h1 className="mt-2 text-2xl font-bold text-[#2A1C2E] sm:text-3xl">{result.data.data.version.title}</h1><p className="mt-2 text-sm text-[#6B5F6F]">Version {result.data.data.version.version} · {result.data.data.version.status === "superseded" ? "Superseded" : "Published"} · {formatDate(result.data.data.version.published_at)}</p></div><Link className="inline-flex min-h-10 items-center rounded-md bg-[#4C1268] px-3 text-sm font-semibold text-white hover:bg-[#3D0E54] focus-visible:outline-2 focus-visible:outline-[#E6007A]" href={policyPath(type)}>View current</Link></div>{result.data.data.version.change_summary ? <p className="mt-5 border-l-2 border-[#E6007A] bg-[#FFF6FA] px-4 py-3 text-sm leading-6 text-[#5D435C]"><strong>Change summary:</strong> {result.data.data.version.change_summary}</p> : null}<div className="mt-7 whitespace-pre-wrap break-words text-[15px] leading-8 text-[#3E3242]">{result.data.data.version.content}</div></article>}</PolicyPageShell>;
}
