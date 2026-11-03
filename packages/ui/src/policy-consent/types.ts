export type ConsentPolicyType = 'terms_of_service' | 'privacy_policy';
export const policyTypes: ConsentPolicyType[] = ['terms_of_service', 'privacy_policy'];

export type ConsentDocument = {
  id: string;
  version: number;
  content: string;
  published_at: string | null;
  change_summary: string | null;
};

export type ConsentPolicy = {
  type: ConsentPolicyType;
  label: string;
  required: boolean;
  accepted: boolean;
  accepted_at: string | null;
  accepted_version: { version: number; accepted_at: string } | null;
  current_version: Omit<ConsentDocument, 'content'> | null;
};

export type ConsentStatus = { policies: ConsentPolicy[]; all_required_accepted: boolean };
export type ConsentSelection = { type: ConsentPolicyType; version: number; confirmation: true };
export type ConsentApi = {
  status: () => Promise<{ data: ConsentStatus }>;
  document: (type: ConsentPolicyType) => Promise<{ data: { version: ConsentDocument } }>;
  accept: (acceptances: ConsentSelection[]) => Promise<{ data: { status: ConsentStatus } }>;
};
