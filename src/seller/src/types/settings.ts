export interface PayoutBankInfo {
  provider: 'GCash' | 'Maya' | 'BDO Unibank' | 'BPI' | 'UnionBank of the Philippines' | 'Metrobank';
  accountName: string;
  accountNumber: string;
  autoDisbursementSchedule: 'daily' | 'weekly' | 'biweekly';
  isVerified: boolean;
}

export interface TaxAndKycInfo {
  registeredEntityName: string;
  tinNumber: string;
  bir2303Status: 'verified' | 'pending_review' | 'unsubmitted';
  bir2303FileName?: string;
  dtiSecRegistrationNumber: string;
  dtiSecFileName?: string;
  govIdFileName?: string;
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
  taxInfo: TaxAndKycInfo;
}
