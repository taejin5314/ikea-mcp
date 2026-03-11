export async function fetchJson<T>(
  url: string,
  headers?: Record<string, string>
): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...headers,
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${url}`);
  }
  return res.json() as Promise<T>;
}
