// Kleiner Fetch-Helfer für Client-Komponenten
export async function api<T = unknown>(url: string, method: 'POST' | 'PATCH' | 'DELETE' | 'GET' = 'POST', body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Fehler (${res.status})`);
  return data as T;
}
