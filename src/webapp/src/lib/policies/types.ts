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

export type PolicyCurrentSummary = {
  id: string;
  version: number;
  title: string;
  change_summary: string | null;
  requires_reconsent: boolean;
  published_at: string | null;
};

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

export type PolicyConsentItem = {
  type: PublicPolicyType;
  label: string;
  required: boolean;
  accepted: boolean;
  accepted_at: string | null;
  current_version: PolicyCurrentSummary | null;
  accepted_version: {
    id: string;
    version: number;
    accepted_at: string;
  } | null;
};

export type PolicyConsentStatusResponse = {
  data: {
    policies: PolicyConsentItem[];
    all_required_accepted: boolean;
  };
};

export type PolicyAcceptanceResponse = {
  data: {
    type: PublicPolicyType;
    label: string;
    version: PolicyVersion;
    accepted_at: string;
  };
};
