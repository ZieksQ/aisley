import { apiRequest, initializeCsrf } from "./api";

const customerAuthPath = "/api/v1/customer/auth";

export type Customer = {
  email: string;
  id: string;
  profile: {
    birth_date: string;
    contact_number: string;
    first_name: string;
    last_name: string;
    middle_name: string | null;
    profile_photo_path: string | null;
    sex: string;
  };
  role: "customer";
  status: string;
};

export type RegisterCustomerPayload = {
  birth_date: string;
  contact_number: string;
  email: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  password: string;
  password_confirmation: string;
  sex: string;
};

async function secureRequest<T>(path: string, body: Record<string, unknown>) {
  await initializeCsrf();

  return apiRequest<T>(`${customerAuthPath}${path}`, {
    body: JSON.stringify(body),
    method: "POST",
  });
}

export function registerCustomer(payload: RegisterCustomerPayload) {
  return secureRequest<{ customer: Customer; message: string }>(
    "/register",
    payload,
  );
}

export function loginCustomer(payload: {
  email: string;
  password: string;
  remember: boolean;
}) {
  return secureRequest<{ customer: Customer; message: string }>("/login", payload);
}

export function requestPasswordReset(email: string) {
  return secureRequest<{ message: string }>("/forgot-password", { email });
}

export function resetCustomerPassword(payload: {
  email: string;
  password: string;
  password_confirmation: string;
  token: string;
}) {
  return secureRequest<{ message: string }>("/reset-password", payload);
}
