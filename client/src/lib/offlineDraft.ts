const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type StoredDraft<T> = {
  savedAt: number;
  expiresAt: number;
  data: T;
};

export function offlineDraftKey(scope: string, userId: string | number, companyId: string) {
  return `fallinity:draft:${scope}:${String(userId)}:${companyId}`;
}

export function saveOfflineDraft<T>(storage: StorageLike, key: string, data: T, ttlMs = DEFAULT_TTL_MS) {
  const savedAt = Date.now();
  const payload: StoredDraft<T> = { savedAt, expiresAt: savedAt + ttlMs, data };
  storage.setItem(key, JSON.stringify(payload));
  return payload;
}

export function loadOfflineDraft<T>(storage: StorageLike, key: string, now = Date.now()): StoredDraft<T> | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const payload = JSON.parse(raw) as StoredDraft<T>;
    if (!payload || typeof payload.savedAt !== "number" || typeof payload.expiresAt !== "number" || payload.expiresAt <= now) {
      storage.removeItem(key);
      return null;
    }
    return payload;
  } catch {
    storage.removeItem(key);
    return null;
  }
}

export function clearOfflineDraft(storage: StorageLike, key: string) {
  storage.removeItem(key);
}
