export type PublicPolicyType = "terms_of_service" | "privacy_policy";

export type PolicyVersion = {
  id: string;
  version: number;
  title: string;
  content: string;
  status: "published" | "superseded";
  change_summary: string | null;
  requires_reconsent: boolean;
  published_at: string | null;
};

export type PolicyHistoryItem = Omit<PolicyVersion, "content" | "requires_reconsent">;

export type PolicyDocumentResponse = {
  data: {
    type: PublicPolicyType;
    label: string;
    version: PolicyVersion;
  };
};

export type PolicyHistoryResponse = {
  data: {
    type: PublicPolicyType;
    label: string;
    versions: PolicyHistoryItem[];
  };
};
