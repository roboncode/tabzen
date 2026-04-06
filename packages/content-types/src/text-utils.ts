/**
 * Decode HTML entities in text
 *
 * Handles common HTML entities like &amp;, &lt;, &gt;, &quot;, &#39;
 * as well as numeric entities like &#39; or &#x27;
 */
export function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&#x27;': "'",
    '&nbsp;': ' ',
  };

  let decoded = text.replace(/&[a-z]+;|&#?\w+;/gi, (match) => {
    return entities[match] || match;
  });

  decoded = decoded.replace(/&#(\d+);/g, (_match, dec) => {
    return String.fromCharCode(dec);
  });

  decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (_match, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });

  return decoded;
}
