export interface PayoutBankInfo {
  provider: 'GCash' | 'Maya' | 'BDO Unibank' | 'BPI' | 'UnionBank of the Philippines' | 'Metrobank';
  accountName: string;
  accountNumber: string;
  autoDisbursementSchedule: 'daily' | 'weekly' | 'biweekly';
  isVerified: boolean;
}

export interface VerificationDocumentsInfo {
  idType: string;
  idFileName: string;
  idFilePreviewUrl?: string;
  idStatus: 'verified' | 'pending_review' | 'unsubmitted';
  businessPermitType: string;
  businessPermitNumber: string;
  businessPermitFileName: string;
  businessPermitFilePreviewUrl?: string;
  businessPermitStatus: 'verified' | 'pending_review' | 'unsubmitted';
}

export interface StoreSettings {
  storeName: string;
  storeSlug: string;
  tagline: string;
  bio: string;
  logoUrl: string;
  bannerUrl: string;
  contactEmail: string;
  contactPhone: string;
  vacationMode: boolean;
  vacationNotice?: string;
  categories: string[];
  payoutBank: PayoutBankInfo;
  verificationDocuments?: VerificationDocumentsInfo;
}
