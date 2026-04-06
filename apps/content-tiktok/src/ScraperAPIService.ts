import axios from "axios";

/**
 * ScraperAPI Service for TikTok
 * Docs: https://docs.scrapecreators.com/v3/tiktok
 */
export class ScraperAPIService {
  private baseUrlV1 = "https://api.scrapecreators.com/v1/tiktok";
  private baseUrlV2 = "https://api.scrapecreators.com/v2/tiktok";
  private baseUrlV3 = "https://api.scrapecreators.com/v3/tiktok";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async makeRequest(
    baseUrl: string,
    endpoint: string,
    params: Record<string, any> = {}
  ) {
    try {
      const url = `${baseUrl}${endpoint}`;
      console.log(`Making request to ScraperAPI: ${url} with params:`, JSON.stringify(params));
      const { data } = await axios.get(url, {
        headers: {
          "x-api-key": this.apiKey,
        },
        params,
        timeout: 30000,
      });
      console.log(`✅ ScraperAPI response for ${endpoint}:`, JSON.stringify(data).slice(0, 500));
      return data;
    } catch (error: any) {
      console.error(
        `ScraperAPI error for ${endpoint}:`,
        error.response?.data || error.message
      );
      throw error;
    }
  }

  /**
   * Get profile information
   * Endpoint: /v1/tiktok/profile
   */
  async getProfile(handle: string) {
    return this.makeRequest(this.baseUrlV1, "/profile", { handle });
  }

  /**
   * Get user's videos with pagination support
   * Endpoint: /v3/tiktok/profile/videos
   * Params: handle (or user_id), amount, cursor (for pagination)
   */
  async getRecentVideos(handle: string, amount: number = 20) {
    const params: any = { handle };
    return this.makeRequest(this.baseUrlV3, "/profile/videos", params);
  }

  /**
   * Get user's videos with pagination support
   * Endpoint: /v3/tiktok/profile/videos
   * Params: handle (or user_id), amount, cursor (for pagination)
   */
  async getVideos(handle: string, amount: number = 20, cursor?: string) {
    const params: any = { handle, amount };
    if (cursor) {
      params.max_cursor = cursor;
    }
    console.log("Fetching videos with params:", params);
    return this.makeRequest(this.baseUrlV3, "/profile-videos", params);
  }

  /**
   * Get video details by video URL
   * Endpoint: /v2/tiktok/video
   * Params: url (video URL), get_transcript (optional), region (optional), trim (optional)
   */
  async getVideo(videoUrl: string, getTranscript: boolean = false) {
    const params: any = {
      url: videoUrl,
      get_transcript: getTranscript,
      region: "US",
      trim: true,
    };

    return this.makeRequest(this.baseUrlV2, "/video", params);
  }

  /**
   * Get video transcript only
   * Endpoint: /v1/tiktok/video/transcript
   * Params: url (video URL)
   */
  async getTranscript(videoUrl: string) {
    return this.makeRequest(this.baseUrlV1, "/video/transcript", { url: videoUrl });
  }
}
