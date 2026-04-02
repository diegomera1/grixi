/**
 * GRIXI API fetch wrapper — adds CSRF protection header
 * All client-side API calls should use this instead of raw fetch()
 */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers || {});
  
  // Add CSRF protection header for mutation requests
  if (!headers.has("X-GRIXI-Client")) {
    headers.set("X-GRIXI-Client", "1");
  }

  return fetch(url, { ...options, headers });
}
