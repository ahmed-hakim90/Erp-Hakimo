type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8787/api";

let getToken: (() => Promise<string | null> | string | null) | null = null;
let onUnauthorized: (() => void) | null = null;

export const registerApiAuth = (options: {
  getToken?: (() => Promise<string | null> | string | null) | null;
  onUnauthorized?: (() => void) | null;
}) => {
  getToken = options.getToken ?? null;
  onUnauthorized = options.onUnauthorized ?? null;
};

const buildUrl = (path: string, query?: Record<string, unknown>) => {
  const url = new URL(
    path.startsWith("/") ? `${API_BASE}${path}` : `${API_BASE}/${path}`,
  );
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      if (Array.isArray(value)) {
        value.forEach((item) => url.searchParams.append(key, String(item)));
        return;
      }
      url.searchParams.set(key, String(value));
    });
  }
  return url.toString();
};

const request = async <T>(
  method: HttpMethod,
  path: string,
  body?: unknown,
  query?: Record<string, unknown>,
): Promise<T> => {
  const token = getToken ? await getToken() : null;
  const res = await fetch(buildUrl(path, query), {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 401 && onUnauthorized) {
    onUnauthorized();
  }

  if (!res.ok) {
    let payload: any = null;
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }
    throw new ApiError(payload?.error || `API request failed (${res.status})`, res.status, payload);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
};

const apiClient = {
  get: <T>(path: string, query?: Record<string, unknown>) =>
    request<T>("GET", path, undefined, query),
  post: <T>(path: string, body?: unknown, query?: Record<string, unknown>) =>
    request<T>("POST", path, body, query),
  put: <T>(path: string, body?: unknown, query?: Record<string, unknown>) =>
    request<T>("PUT", path, body, query),
  delete: <T>(path: string, query?: Record<string, unknown>) =>
    request<T>("DELETE", path, undefined, query),
};

export default apiClient;

