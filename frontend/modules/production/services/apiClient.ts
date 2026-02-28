type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

type TokenProvider = () => string | null | Promise<string | null>;

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api').replace(/\/+$/, '');

let tokenProvider: TokenProvider = () => {
  const direct = localStorage.getItem('hakimo_access_token');
  if (direct) return direct;

  // Supabase persists session in keys like: sb-<project-ref>-auth-token
  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith('sb-') || !key.endsWith('-auth-token')) continue;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const token = parsed?.access_token || parsed?.currentSession?.access_token;
      if (typeof token === 'string' && token) return token;
    } catch {
      // ignore malformed cache rows
    }
  }

  return null;
};

export const setApiTokenProvider = (provider: TokenProvider) => {
  tokenProvider = provider;
};

export interface RequestOptions {
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  tenantId?: string;
}

const toQueryString = (query?: RequestOptions['query']) => {
  if (!query) return '';
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params.append(key, String(value));
  });
  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
};

export const apiRequest = async <T>(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<T> => {
  const token = await tokenProvider();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.tenantId) headers['x-tenant-id'] = options.tenantId;

  const response = await fetch(`${apiBaseUrl}${path}${toQueryString(options.query)}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const data = await response.json();
      message = data?.error || message;
    } catch {
      // ignore non-json errors
    }
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
};
