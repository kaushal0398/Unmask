/**
 * Which web addresses may call this backend from a browser. Always the two local addresses; add deployed ones with
 * CORS_ORIGINS, a comma-separated list such as "https://unmask.example.com,https://preview.example.com".
 * Only exact origins are accepted: a wildcard is refused, because the API takes a bearer token from the browser.
 */
const LOCAL = ["http://localhost:3000", "http://127.0.0.1:3000"];

export function corsOrigins(value: string | undefined): string[] {
  const extra = (value ?? "").split(",").map((s) => s.trim().replace(/\/+$/, "")).filter(Boolean);
  for (const o of extra) {
    if (o === "*" || !/^https?:\/\/[^\s/*]+$/.test(o)) throw new Error(`CORS_ORIGINS has an invalid entry "${o}": use exact origins like https://app.example.com (no wildcard, no path).`);
  }
  return [...new Set([...LOCAL, ...extra])];
}
