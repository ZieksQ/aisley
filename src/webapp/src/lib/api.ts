const apiBaseUrl = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
).replace(/\/$/, "");

type ErrorPayload = {
  code?: string;
  errors?: Record<string, string[]>;
  message?: string;
};

export class ApiError extends Error {
  readonly code?: string;
  readonly errors: Record<string, string[]>;
  readonly status: number;

  constructor(status: number, payload: ErrorPayload) {
    super(payload.message ?? "Something went wrong. Please try again.");
    this.name = "ApiError";
    this.code = payload.code;
    this.errors = payload.errors ?? {};
    this.status = status;
  }
}

function apiUrl(path: string) {
  return `${apiBaseUrl}${path}`;
}

function csrfToken() {
  const cookie = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith("XSRF-TOKEN="));

  return cookie
    ? decodeURIComponent(cookie.split("=").slice(1).join("="))
    : null;
}

export async function initializeCsrf() {
  const response = await fetch(apiUrl("/sanctum/csrf-cookie"), {
    credentials: "include",
    headers: {
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
  });

  if (!response.ok) {
    throw new ApiError(response.status, {
      message: "We could not start a secure session. Please try again.",
    });
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  headers.set("X-Requested-With", "XMLHttpRequest");

  if (options.body) {
    headers.set("Content-Type", "application/json");
  }

  const token = csrfToken();
  if (token) {
    headers.set("X-XSRF-TOKEN", token);
  }

  const response = await fetch(apiUrl(path), {
    ...options,
    credentials: "include",
    headers,
  });
  const payload = (await response.json().catch(() => ({}))) as ErrorPayload & T;

  if (!response.ok) {
    throw new ApiError(response.status, payload);
  }

  return payload;
}

export function firstFieldError(
  error: ApiError | null,
  field: string,
): string | undefined {
  return error?.errors[field]?.[0];
}
