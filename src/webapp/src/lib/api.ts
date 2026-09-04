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

  if (options.body && !(options.body instanceof FormData)) {
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

export async function apiUploadRequest<T>(
  path: string,
  body: FormData,
  onProgress?: (percent: number) => void,
): Promise<T> {
  await initializeCsrf();

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", apiUrl(path));
    request.withCredentials = true;
    request.setRequestHeader("Accept", "application/json");
    request.setRequestHeader("X-Requested-With", "XMLHttpRequest");

    const token = csrfToken();
    if (token) request.setRequestHeader("X-XSRF-TOKEN", token);

    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    });
    request.addEventListener("load", () => {
      const payload = (() => {
        try {
          return JSON.parse(request.responseText) as ErrorPayload & T;
        } catch {
          return {} as ErrorPayload & T;
        }
      })();

      if (request.status >= 200 && request.status < 300) {
        onProgress?.(100);
        resolve(payload);
      } else {
        reject(new ApiError(request.status, payload));
      }
    });
    request.addEventListener("error", () => {
      reject(new ApiError(0, { message: "We could not upload the image. Check your connection and try again." }));
    });
    request.send(body);
  });
}

export async function apiBlobRequest(path: string): Promise<Blob> {
  const response = await fetch(apiUrl(path), {
    cache: "no-store",
    credentials: "include",
    headers: {
      Accept: "image/jpeg,image/png,image/webp",
      "X-Requested-With": "XMLHttpRequest",
    },
  });

  if (!response.ok) {
    throw new ApiError(response.status, { message: "We could not load the profile photo." });
  }

  return response.blob();
}

export function firstFieldError(
  error: ApiError | null,
  field: string,
): string | undefined {
  return error?.errors[field]?.[0];
}
