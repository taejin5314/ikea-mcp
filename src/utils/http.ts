const RETRY_DELAY_MS = 500;

function shouldRetry(status: number): boolean {
  return status === 429 || status >= 500;
}

async function attempt<T>(url: string, headers: Record<string, string>): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/json", ...headers } });
  if (!res.ok) {
    if (shouldRetry(res.status)) {
      const retryAfter = Number(res.headers.get("Retry-After") ?? 0) * 1000;
      throw Object.assign(new Error(`HTTP ${res.status} ${res.statusText}: ${url}`), {
        retryable: true,
        delay: retryAfter > 0 ? retryAfter : RETRY_DELAY_MS,
      });
    }
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${url}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchJson<T>(
  url: string,
  headers: Record<string, string> = {}
): Promise<T> {
  try {
    return await attempt<T>(url, headers);
  } catch (err) {
    const e = err as Error & { retryable?: boolean; delay?: number };
    if (e.retryable) {
      await new Promise((r) => setTimeout(r, e.delay ?? RETRY_DELAY_MS));
      return attempt<T>(url, headers);
    }
    // Network-level failures (TypeError from fetch) also get one retry.
    if (err instanceof TypeError) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      return attempt<T>(url, headers);
    }
    throw err;
  }
}

/**
 * Runs tasks with at most `limit` concurrent promises, preserving input order.
 */
export async function pMap<T, U>(
  items: T[],
  fn: (item: T) => Promise<U>,
  limit: number
): Promise<U[]> {
  const results: U[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}
