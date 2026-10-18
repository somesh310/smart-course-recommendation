const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
export const TOKEN_KEY = 'pathwise-token';

export class ApiClientError extends Error {
  constructor(message, { status = 0, errors = [], code = 'API_ERROR' } = {}) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.errors = errors;
    this.code = code;
  }
}

export async function apiRequest(path, options = {}) {
  if (!base) throw new ApiClientError('VITE_API_BASE_URL is not configured.', { code: 'CONFIG_ERROR' });
  const { token, auth = true, headers, ...fetchOptions } = options;
  const accessToken = auth ? (token ?? localStorage.getItem(TOKEN_KEY)) : null;
  let response;
  try {
    response = await fetch(`${base}${path}`, {
      ...fetchOptions,
      headers: {
        Accept: 'application/json',
        ...(fetchOptions.body ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
      },
    });
  } catch {
    throw new ApiClientError('Could not reach the API. Check that the backend is running.', { code: 'NETWORK_ERROR' });
  }
  let body;
  try { body = await response.json(); } catch { body = null; }
  if (!response.ok) {
    const error = new ApiClientError(body?.message || `Request failed (${response.status}).`, { status: response.status, errors: body?.errors || [] });
    if (response.status === 401 && accessToken) window.dispatchEvent(new CustomEvent('pathwise:unauthorized'));
    throw error;
  }
  return body;
}

export const queryString = (values = {}) => {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== '') params.set(key, String(value)); });
  const query = params.toString();
  return query ? `?${query}` : '';
};
