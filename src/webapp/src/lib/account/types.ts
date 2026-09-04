import type { AuthenticatedCustomer } from "@/lib/auth/types";

export type CustomerSex =
  | "female"
  | "male"
  | "non_binary"
  | "prefer_not_to_say";

export type CustomerAccount = {
  email: string;
  id: string;
  profile: {
    age: number | null;
    birthDate: string;
    contactNumber: string;
    firstName: string;
    lastName: string;
    middleName: string | null;
    sex: CustomerSex;
  };
  role: "customer";
  security: {
    emailEditable: false;
    passwordChangeRequiresCurrentPassword: true;
  };
  status: "active";
};

export type CustomerAccountResponse = { account: CustomerAccount };

export type CustomerProfileMutationResponse = CustomerAccountResponse & {
  customer: AuthenticatedCustomer;
  message: string;
};

export type CustomerProfilePayload = {
  birth_date: string;
  contact_number: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  sex: CustomerSex | "";
};

export type CustomerPasswordPayload = {
  current_password: string;
  password: string;
  password_confirmation: string;
};
