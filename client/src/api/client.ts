const BASE_URL = '/api/v1';

function getToken(): string | null {
  const stored = localStorage.getItem('auth');
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as { state?: { token?: string } };
    return parsed.state?.token ?? null;
  } catch {
    return null;
  }
}

export type ApiSuccess<T> = { data: T; error: null };
export type ApiError = { data: null; error: { code: string; message: string } };
export type ApiResult<T> = ApiSuccess<T> | ApiError;

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResult<T>> {
  const token = getToken();

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers as Record<string, string>),
      },
    });
  } catch {
    return { data: null, error: { code: 'NETWORK_ERROR', message: 'Cannot reach server. Is it running?' } };
  }

  try {
    const json = (await response.json()) as ApiResult<T>;
    return json;
  } catch {
    return { data: null, error: { code: 'PARSE_ERROR', message: `Server returned status ${response.status}` } };
  }
}
