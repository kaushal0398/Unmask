/**
 * Token pictures live only in this browser (localStorage), keyed by launch id. They are never sent to the backend,
 * so they need no database change, and other visitors do not see them. Every access is guarded: storage can be
 * blocked or full, and the UI must work without it.
 */
const key = (id: string) => `token-image:${id}`;

export function saveTokenImage(id: string, dataUrl: string): void {
  try {
    localStorage.setItem(key(id), dataUrl);
  } catch {
    /* blocked or full: the launch still works with its emoji */
  }
}

export function readTokenImage(id: string): string | undefined {
  try {
    if (typeof localStorage === "undefined") return undefined;
    return localStorage.getItem(key(id)) ?? undefined;
  } catch {
    return undefined;
  }
}
