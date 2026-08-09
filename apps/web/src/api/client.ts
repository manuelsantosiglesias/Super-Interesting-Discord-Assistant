const getBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  return '';
};

const BASE_URL = getBaseUrl();

export class ApiError extends Error {
  public code: string;
  public statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

export async function apiRequest<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  
  options.credentials = 'include';
  options.headers = {
    ...options.headers,
  };

  if (options.body !== undefined && !(options.body instanceof FormData) && !(options.headers as any)?.['Content-Type']) {
    (options.headers as any)['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, options);

  if (response.status === 401) {
    if (!window.location.pathname.endsWith('/login')) {
      window.location.href = '/login';
    }
  }

  if (!response.ok) {
    let errBody: any = {};
    try {
      errBody = await response.json();
    } catch {}

    const code = errBody.error?.code || 'API_ERROR';
    const message = errBody.error?.message || 'Ocurrió un error en la solicitud.';
    throw new ApiError(code, message, response.status);
  }

  if (response.status === 204) {
    return {} as any;
  }

  const contentType = response.headers.get('content-type');
  if (contentType && (contentType.includes('audio/') || contentType.includes('application/octet-stream'))) {
    return response as any;
  }

  return response.json();
}
export { BASE_URL };
