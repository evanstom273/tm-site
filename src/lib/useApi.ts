import { useEffect, useState } from "react";
import { FRESH_FOR_MS, readCache, writeCache } from "./cache";

export interface ApiState<T> {
  data?: T;
  error?: string;
  loading: boolean;
  /** Set when showing a cached copy because the network request failed. */
  offline?: boolean;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
  return body as T;
}

/**
 * GET an /api path. Serves the IndexedDB copy first if there is one, and only
 * goes to the server when the copy is missing or more than an hour old.
 */
export function useApi<T>(url: string): ApiState<T> {
  const [state, setState] = useState<ApiState<T>>({ loading: true });

  useEffect(() => {
    let cancelled = false;
    // Keep showing the previous page's data while the next one loads.
    setState((s) => ({ data: s.data, loading: true }));

    (async () => {
      const cached = await readCache<T>(url);
      if (cancelled) return;
      if (cached) {
        setState({ data: cached.data, loading: false });
        if (Date.now() - cached.fetchedAt < FRESH_FOR_MS) return;
      }
      try {
        const data = await fetchJson<T>(url);
        if (cancelled) return;
        setState({ data, loading: false });
        void writeCache(url, data);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setState(cached ? { data: cached.data, loading: false, offline: true } : { loading: false, error: message });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  return state;
}
