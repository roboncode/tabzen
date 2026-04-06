import * as cheerio from "cheerio";
import axios from "axios";

export class YouTubeResolver {
  /**
   * Resolves a YouTube channel ID from various input formats:
   * - Full URL: https://www.youtube.com/@username
   * - Handle: @username
   * - Username: username
   * - Channel ID: UCxxxxxxxxxxxxxxxxxx (returns as-is)
   */
  async resolveChannelId(input: string): Promise<string | null> {
    const trimmed = input.trim();

    // If it's already a channel ID (starts with UC and is 24 chars), return it
    if (/^UC[\w-]{22}$/.test(trimmed)) {
      return trimmed;
    }

    // Build the URL to scrape
    let url: string;
    if (trimmed.startsWith("http")) {
      url = trimmed;
    } else if (trimmed.startsWith("@")) {
      url = `https://www.youtube.com/${trimmed}`;
    } else {
      url = `https://www.youtube.com/@${trimmed}`;
    }

    try {
      // Fetch the page with proper headers
      const { data: html } = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
        timeout: 10000,
      });

      // Strategy 1: Look for meta tag with itemprop="channelId"
      const $ = cheerio.load(html);
      const metaChannelId = $('meta[itemprop="channelId"]').attr("content");
      if (metaChannelId) {
        return metaChannelId;
      }

      // Strategy 2: Look for link tag with itemprop="url"
      const linkUrl = $('link[itemprop="url"]').attr("href");
      if (linkUrl) {
        const match = linkUrl.match(/channel\/(UC[\w-]{22})/);
        if (match) return match[1];
      }

      // Strategy 3: Search in JSON-LD structured data
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const json = JSON.parse($(el).html() || "{}");
          if (json["@type"] === "Person" && json.identifier) {
            const channelId = json.identifier;
            if (/^UC[\w-]{22}$/.test(channelId)) {
              return channelId;
            }
          }
        } catch (e) {
          // Continue to next script tag
        }
      });

      // Strategy 4: Search in inline ytInitialData
      const ytInitialDataMatch = html.match(/var ytInitialData = ({.+?});/);
      if (ytInitialDataMatch) {
        try {
          const ytData = JSON.parse(ytInitialDataMatch[1]);
          const channelId = this.extractChannelIdFromYtData(ytData);
          if (channelId) return channelId;
        } catch (e) {
          // Continue to next strategy
        }
      }

      // Strategy 5: Search for channelId in any script tag or JSON
      const channelIdRegex = /"channelId":"(UC[\w-]{22})"/g;
      let match;
      while ((match = channelIdRegex.exec(html)) !== null) {
        return match[1];
      }

      // Strategy 6: Look for externalId in ytInitialData
      const externalIdMatch = html.match(/"externalId":"(UC[\w-]{22})"/);
      if (externalIdMatch) {
        return externalIdMatch[1];
      }

      // Strategy 7: Look in canonical URL
      const canonicalUrl = $('link[rel="canonical"]').attr("href");
      if (canonicalUrl) {
        const match = canonicalUrl.match(/channel\/(UC[\w-]{22})/);
        if (match) return match[1];
      }

      return null;
    } catch (error) {
      console.error("Error resolving channel ID:", error);
      return null;
    }
  }

  /**
   * Recursively search for channelId in ytInitialData object
   */
  private extractChannelIdFromYtData(obj: any): string | null {
    if (!obj || typeof obj !== "object") return null;

    // Check if current object has channelId or externalId
    if (obj.channelId && /^UC[\w-]{22}$/.test(obj.channelId)) {
      return obj.channelId;
    }
    if (obj.externalId && /^UC[\w-]{22}$/.test(obj.externalId)) {
      return obj.externalId;
    }

    // Recursively search in nested objects and arrays
    for (const key in obj) {
      const result = this.extractChannelIdFromYtData(obj[key]);
      if (result) return result;
    }

    return null;
  }
}
