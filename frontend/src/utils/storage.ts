// Generic localStorage abstraction with optional expiration
export function getCachedItem<T>(key: string): T | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed._expiresAt) {
      if (Date.now() > parsed._expiresAt) {
        localStorage.removeItem(key);
        return null;
      }
      return parsed.value as T;
    }
    return parsed as T;
  } catch {
    return null;
  }
}

export function setCachedItem<T>(key: string, value: T, ttlMs?: number) {
  if (ttlMs) {
    localStorage.setItem(
      key,
      JSON.stringify({ value, _expiresAt: Date.now() + ttlMs })
    );
  } else {
    localStorage.setItem(key, JSON.stringify(value));
  }
}

export function removeCachedItem(key: string) {
  localStorage.removeItem(key);
}
