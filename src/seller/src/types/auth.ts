export type Sex = 'Female' | 'Male' | 'Non-binary' | 'Prefer not to say';

export type ApprovalStatus = 'approved' | 'pending' | 'rejected';

export interface SellerProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  middleInitial?: string;
  sex: Sex;
  contactNo: string;
  birthday: string;
  age: number;
  businessName: string;
  businessCategory: string;
  address: {
    province: string;
    city: string;
    barangay: string;
    street: string;
    houseNumber: string;
    postalCode: string;
  };
  kyc: {
    idType: string;
    idFileName: string;
    businessPermitFileName: string;
    submittedAt: string;
  };
  status: ApprovalStatus;
  avatarUrl?: string;
  createdAt: string;
}

export interface ApprovalMilestone {
  id: string;
  title: string;
  description: string;
  status: 'completed' | 'in_progress' | 'pending';
  timestamp?: string;
}
