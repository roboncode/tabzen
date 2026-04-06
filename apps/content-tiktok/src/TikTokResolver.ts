import axios from "axios";

export class TikTokResolver {
  /**
   * Resolves a TikTok username/handle from various input formats:
   * - Full URL: https://www.tiktok.com/@username
   * - Username with @: @username
   * - Username: username
   */
  async resolveHandle(input: string): Promise<string | null> {
    const trimmed = input.trim();

    // If it's a username pattern (alphanumeric, dots, underscores)
    // TikTok usernames can contain letters, numbers, underscores, and periods
    if (/^@?[a-zA-Z0-9_.]+$/.test(trimmed)) {
      // Return with @ prefix if not already present
      return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
    }

    // Extract username from URL
    if (trimmed.startsWith("http")) {
      const match = trimmed.match(/tiktok\.com\/@([a-zA-Z0-9_.]+)/);
      if (match) {
        return `@${match[1]}`;
      }
    }

    return null;
  }

  /**
   * Validates if a handle exists on TikTok
   * Note: This is a basic validation, actual validation would require hitting TikTok
   */
  async validateHandle(handle: string): Promise<boolean> {
    try {
      // Basic format validation
      const cleanHandle = handle.replace(/^@/, "");
      return /^[a-zA-Z0-9_.]+$/.test(cleanHandle);
    } catch (error) {
      return false;
    }
  }
}
