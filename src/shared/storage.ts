/** Read a JSON value from localStorage, returning `fallback` if absent or unparseable. */
export const load = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

/** Write a JSON value to localStorage. No-ops if storage is unavailable or full. */
export const save = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
};
