export type AuthenticatedCustomer = {
  avatarUrl: string | null;
  displayName: string | null;
  id: string;
  role: "customer";
  status: "active";
};

export type AuthState =
  | { status: "loading"; error?: string }
  | { status: "guest" }
  | { status: "authenticated"; customer: AuthenticatedCustomer };
