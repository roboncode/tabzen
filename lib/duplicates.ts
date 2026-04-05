const UTM_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "ref",
];

export function normalizeUrl(raw: string): string {
  try {
    const url = new URL(raw);
    for (const param of UTM_PARAMS) {
      url.searchParams.delete(param);
    }
    url.searchParams.sort();
    if (url.pathname.endsWith("/") && url.pathname.length > 1) {
      url.pathname = url.pathname.slice(0, -1);
    }
    return url.toString();
  } catch {
    return raw;
  }
}

export function isDuplicate(url: string, existingUrls: Set<string>): boolean {
  return existingUrls.has(normalizeUrl(url));
}

export function buildUrlSet(urls: string[]): Set<string> {
  return new Set(urls.map(normalizeUrl));
}
