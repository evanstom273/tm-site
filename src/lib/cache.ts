import Dexie, { type EntityTable } from "dexie";

// IndexedDB copy of API responses, so pages you've already opened load
// instantly and still work with no signal.

export interface CachedResponse {
  url: string;
  data: unknown;
  fetchedAt: number;
}

export const cacheDb = new Dexie("tm-site") as Dexie & {
  responses: EntityTable<CachedResponse, "url">;
};

cacheDb.version(1).stores({
  responses: "url, fetchedAt",
});

/** Cached responses younger than this are used without asking the server. */
export const FRESH_FOR_MS = 60 * 60 * 1000;
const KEEP_FOR_MS = 14 * 24 * 60 * 60 * 1000;

export async function readCache<T>(url: string): Promise<{ data: T; fetchedAt: number } | undefined> {
  try {
    const hit = await cacheDb.responses.get(url);
    return hit ? { data: hit.data as T, fetchedAt: hit.fetchedAt } : undefined;
  } catch {
    return undefined; // IndexedDB unavailable (private mode etc.): just go to the network
  }
}

export async function writeCache(url: string, data: unknown) {
  try {
    await cacheDb.responses.put({ url, data, fetchedAt: Date.now() });
  } catch {
    // ignore: caching is best-effort
  }
}

export async function pruneCache() {
  try {
    await cacheDb.responses.where("fetchedAt").below(Date.now() - KEEP_FOR_MS).delete();
  } catch {
    // ignore
  }
}
