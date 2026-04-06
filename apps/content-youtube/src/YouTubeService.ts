import * as cheerio from "cheerio";

import { ChannelInfo, TranscriptSegment, Video, VideoInfo, VideoListResponse } from "./models"

import { YouTubeResolver } from "./YouTubeResolver";
import axios from "axios";
import { fetchTranscript } from "youtube-transcript-plus";
import { parseStringPromise } from "xml2js";
import { decodeHtmlEntities } from "@tab-zen/content-types";

export class YouTubeService {
  private resolver: YouTubeResolver;

  constructor(private apiKey?: string) {
    this.resolver = new YouTubeResolver();
  }

  // --- 1. Resolve Channel ID ---
  async getChannelId(input: string): Promise<string | null> {
    return this.resolver.resolveChannelId(input);
  }

  // --- 2. Get Channel Info ---
  async getChannelInfo(input: string): Promise<ChannelInfo> {
    const channelId = await this.getChannelId(input);
    if (!channelId) throw new Error("Unable to resolve channel");

    const rss = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    const { data: xml } = await axios.get(rss);
    const parsed = await parseStringPromise(xml);

    const feed = parsed.feed;

    // Get thumbnail, handle, and description from the channel page
    const { thumbnail, handle, description } = await this.getChannelMetadata(channelId);

    return {
      id: channelId,
      name: feed.author[0].name[0],
      url: feed.author[0].uri[0],
      handle,
      description: description || feed.title?.[0], // Use actual description, fallback to title
      thumbnail,
    };
  }

  private async getChannelMetadata(channelId: string): Promise<{ thumbnail?: string; handle?: string; description?: string }> {
    try {
      const url = `https://www.youtube.com/channel/${channelId}`;
      const { data: html } = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        timeout: 10000,
      });

      const $ = cheerio.load(html);

      let thumbnail: string | undefined;
      let handle: string | undefined;
      let description: string | undefined;

      // Extract description from meta tag
      const ogDescription = $('meta[property="og:description"]').attr("content");
      if (ogDescription) description = ogDescription;

      // Also try standard meta description
      if (!description) {
        const metaDescription = $('meta[name="description"]').attr("content");
        if (metaDescription) description = metaDescription;
      }

      // Try meta tag with property="og:image"
      const ogImage = $('meta[property="og:image"]').attr("content");
      if (ogImage) thumbnail = ogImage;

      // Try to find in ytInitialData
      const ytInitialDataMatch = html.match(/var ytInitialData = ({.+?});/);
      if (ytInitialDataMatch) {
        const ytData = JSON.parse(ytInitialDataMatch[1]);

        if (!thumbnail) {
          thumbnail = this.extractThumbnailFromYtData(ytData);
        }

        // Extract handle from ytInitialData
        handle = this.extractHandleFromYtData(ytData);

        // Extract description from ytInitialData if not found in meta tags
        if (!description) {
          description = this.extractDescriptionFromYtData(ytData);
        }
      }

      // Try link tag with itemprop="thumbnailUrl"
      if (!thumbnail) {
        const thumbnailUrl = $('link[itemprop="thumbnailUrl"]').attr("href");
        if (thumbnailUrl) thumbnail = thumbnailUrl;
      }

      // Try to extract handle from canonical URL or page
      if (!handle) {
        const canonicalUrl = $('link[rel="canonical"]').attr("href");
        if (canonicalUrl) {
          const handleMatch = canonicalUrl.match(/@([\w-]+)/);
          if (handleMatch) handle = handleMatch[1]; // Without @ prefix
        }
      }

      // Try meta tag with property="og:url"
      if (!handle) {
        const ogUrl = $('meta[property="og:url"]').attr("content");
        if (ogUrl) {
          const handleMatch = ogUrl.match(/@([\w-]+)/);
          if (handleMatch) handle = handleMatch[1]; // Without @ prefix
        }
      }

      return { thumbnail, handle, description };
    } catch (error) {
      console.error("Error fetching channel metadata:", error);
      return {};
    }
  }

  private extractThumbnailFromYtData(obj: any): string | undefined {
    if (!obj || typeof obj !== "object") return undefined;

    // Look for thumbnail or avatar objects
    if (obj.url && typeof obj.url === "string" && obj.url.includes("yt3.ggpht.com")) {
      return obj.url;
    }

    if (obj.thumbnails && Array.isArray(obj.thumbnails) && obj.thumbnails.length > 0) {
      const thumbnail = obj.thumbnails[obj.thumbnails.length - 1]; // Get highest quality
      if (thumbnail.url) return thumbnail.url;
    }

    // Recursively search
    for (const key in obj) {
      const result = this.extractThumbnailFromYtData(obj[key]);
      if (result) return result;
    }

    return undefined;
  }

  private extractHandleFromYtData(obj: any): string | undefined {
    if (!obj || typeof obj !== "object") return undefined;

    // Look for canonicalChannelUrl or channelHandle
    if (obj.canonicalChannelUrl && typeof obj.canonicalChannelUrl === "string") {
      const match = obj.canonicalChannelUrl.match(/@([\w-]+)/);
      if (match) return match[1]; // Return without @ prefix
    }

    if (obj.channelHandle && typeof obj.channelHandle === "string") {
      // Remove @ prefix if present
      return obj.channelHandle.startsWith("@") ? obj.channelHandle.slice(1) : obj.channelHandle;
    }

    if (obj.vanityChannelUrl && typeof obj.vanityChannelUrl === "string") {
      const match = obj.vanityChannelUrl.match(/@([\w-]+)/);
      if (match) return match[1]; // Return without @ prefix
    }

    // Recursively search
    for (const key in obj) {
      const result = this.extractHandleFromYtData(obj[key]);
      if (result) return result;
    }

    return undefined;
  }

  private extractDescriptionFromYtData(obj: any): string | undefined {
    if (!obj || typeof obj !== "object") return undefined;

    // Look for description field in channel metadata
    if (obj.description && typeof obj.description === "string") {
      return obj.description;
    }

    // Look for channelMetadataRenderer description
    if (obj.channelMetadataRenderer?.description) {
      return obj.channelMetadataRenderer.description;
    }

    // Look for microformat channelDescriptionText
    if (obj.microformat?.microformatDataRenderer?.description) {
      return obj.microformat.microformatDataRenderer.description;
    }

    // Look for aboutChannelViewModel descriptionPreview
    if (obj.aboutChannelViewModel?.description) {
      return obj.aboutChannelViewModel.description;
    }

    // Recursively search (limit depth to avoid performance issues)
    for (const key in obj) {
      if (key === "contents" || key === "runs" || key === "items") continue; // Skip large arrays
      const result = this.extractDescriptionFromYtData(obj[key]);
      if (result) return result;
    }

    return undefined;
  }

  // --- 3. Get Recent Videos (RSS only) ---
  async getRecentVideos(input: string): Promise<VideoListResponse> {
    const channelId = await this.getChannelId(input);
    if (!channelId) throw new Error("Unable to resolve channel");

    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    const { data: xml } = await axios.get(feedUrl);
    const parsed = await parseStringPromise(xml);
    const entries = parsed.feed.entry || [];

    const videos: Video[] = entries.map((e: any) => ({
      id: e["yt:videoId"][0],
      title: e.title[0],
      description: this.truncateDescription(e["media:group"][0]["media:description"][0]),
      published: e.published[0],
      thumbnail: e["media:group"][0]["media:thumbnail"][0].$.url,
      channelId,
      channelName: parsed.feed.author[0].name[0],
      length: e["media:group"][0]["media:content"]?.[0]?.$.duration
        ? this.formatDuration(e["media:group"][0]["media:content"][0].$.duration)
        : undefined,
    }));

    return {
      videos,
      pageInfo: {
        resultsPerPage: videos.length,
      },
    };
  }

  // --- 4. Get Videos (YouTube API with pagination) ---
  async getVideos(
    input: string,
    options: { pageToken?: string; maxResults?: number; publishedAfter?: string; publishedBefore?: string; includeDuration?: boolean } = {}
  ): Promise<VideoListResponse> {
    if (!this.apiKey) {
      throw new Error("YouTube API key is required for this endpoint");
    }

    const channelId = await this.getChannelId(input);
    if (!channelId) throw new Error("Unable to resolve channel");

    // YouTube API allows 1-50 results per page, default to 25
    const maxResults = Math.min(Math.max(options.maxResults || 25, 1), 50);

    // Build URL with optional date filters
    let url = `https://www.googleapis.com/youtube/v3/search?part=snippet,id&channelId=${channelId}&order=date&type=video&maxResults=${maxResults}`;

    if (options.pageToken) {
      url += `&pageToken=${options.pageToken}`;
    }

    if (options.publishedAfter) {
      url += `&publishedAfter=${options.publishedAfter}`;
    }

    if (options.publishedBefore) {
      url += `&publishedBefore=${options.publishedBefore}`;
    }

    url += `&key=${this.apiKey}`;

    const { data } = await axios.get(url);

    // Fetch video durations using Videos API (optional, requires additional API call)
    let durations: { [key: string]: string } = {};
    if (options.includeDuration && data.items.length > 0) {
      const videoIds = data.items.map((v: any) => v.id.videoId).join(",");
      try {
        const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds}&key=${this.apiKey}`;
        const { data: videosData } = await axios.get(videosUrl);

        durations = videosData.items.reduce((acc: any, item: any) => {
          acc[item.id] = this.parseISO8601Duration(item.contentDetails.duration);
          return acc;
        }, {});
      } catch (error) {
        console.error("Error fetching video durations:", error);
      }
    }

    const videos: Video[] = data.items.map((v: any) => ({
      id: v.id.videoId,
      title: v.snippet.title,
      description: this.truncateDescription(v.snippet.description),
      published: v.snippet.publishedAt,
      thumbnail: v.snippet.thumbnails.medium.url,
      channelId,
      channelName: v.snippet.channelTitle,
      length: durations[v.id.videoId],
    }));

    return {
      videos,
      pageInfo: {
        totalResults: data.pageInfo?.totalResults,
        resultsPerPage: data.pageInfo?.resultsPerPage || maxResults,
      },
      nextPageToken: data.nextPageToken,
      prevPageToken: data.prevPageToken,
    };
  }

  // --- 4. Get Video Info ---
  async getVideo(videoId: string): Promise<VideoInfo> {
    try {
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      const { data: html } = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        timeout: 10000,
      });

      const $ = cheerio.load(html);

      // Extract from meta tags
      const title = $('meta[property="og:title"]').attr("content") || $('meta[name="title"]').attr("content") || "";
      const description = $('meta[property="og:description"]').attr("content") || $('meta[name="description"]').attr("content") || "";
      const thumbnail = $('meta[property="og:image"]').attr("content") || "";

      // Extract from ytInitialData
      let videoInfo: Partial<VideoInfo> = {
        id: videoId,
        title,
        description,
        thumbnail,
        url: url,
      };

      const ytInitialDataMatch = html.match(/var ytInitialData = ({.+?});/);
      if (ytInitialDataMatch) {
        try {
          const ytData = JSON.parse(ytInitialDataMatch[1]);
          const videoDetails = this.extractVideoDetailsFromYtData(ytData);
          videoInfo = { ...videoInfo, ...videoDetails };
        } catch (e) {
          console.error("Error parsing ytInitialData:", e);
        }
      }

      // Extract from ytInitialPlayerResponse
      const ytPlayerMatch = html.match(/var ytInitialPlayerResponse = ({.+?});/);
      if (ytPlayerMatch) {
        try {
          const playerData = JSON.parse(ytPlayerMatch[1]);
          if (playerData.videoDetails) {
            const details = playerData.videoDetails;
            videoInfo.title = details.title || videoInfo.title;
            videoInfo.description = details.shortDescription || videoInfo.description;
            videoInfo.channelId = details.channelId || videoInfo.channelId;
            videoInfo.channelName = details.author || videoInfo.channelName;
            videoInfo.length = details.lengthSeconds ? this.formatDuration(parseInt(details.lengthSeconds)) : videoInfo.length;
            videoInfo.viewCount = details.viewCount || videoInfo.viewCount;
            videoInfo.tags = details.keywords || videoInfo.tags;
          }
        } catch (e) {
          console.error("Error parsing ytInitialPlayerResponse:", e);
        }
      }

      // Also extract hashtags from description
      if (videoInfo.description) {
        const hashtagsInDescription = this.extractHashtagsFromDescription(videoInfo.description);
        if (hashtagsInDescription.length > 0 && !videoInfo.tags) {
          videoInfo.tags = hashtagsInDescription;
        } else if (hashtagsInDescription.length > 0 && videoInfo.tags) {
          // Merge unique hashtags
          videoInfo.tags = [...new Set([...videoInfo.tags, ...hashtagsInDescription])];
        }
      }

      return videoInfo as VideoInfo;
    } catch (error) {
      console.error("Error fetching video info:", error);
      throw new Error("Unable to fetch video information");
    }
  }

  private extractHashtagsFromDescription(description: string): string[] {
    // Match hashtags (# followed by word characters, numbers, underscores)
    const hashtagRegex = /#[\w\u00C0-\u017F]+/g;
    const hashtags = description.match(hashtagRegex) || [];
    // Remove # prefix to normalize with YouTube keywords
    return [...new Set(hashtags.map(tag => tag.slice(1)))]; // Remove duplicates and # prefix
  }

  private extractVideoDetailsFromYtData(obj: any): Partial<VideoInfo> {
    const details: Partial<VideoInfo> = {};

    if (!obj || typeof obj !== "object") return details;

    // Look for video details
    if (obj.videoDetails) {
      details.title = obj.videoDetails.title;
      details.channelId = obj.videoDetails.channelId;
      details.description = obj.videoDetails.shortDescription;
      details.viewCount = obj.videoDetails.viewCount;
      details.tags = obj.videoDetails.keywords;
    }

    // Look for channel name and handle
    if (obj.author) {
      details.channelName = obj.author;
    }

    if (obj.ownerChannelName) {
      details.channelName = obj.ownerChannelName;
    }

    if (obj.channelHandle) {
      details.channelHandle = obj.channelHandle;
    }

    // Look for engagement stats
    if (obj.likeCount) {
      details.likeCount = obj.likeCount;
    }

    if (obj.viewCount) {
      details.viewCount = obj.viewCount;
    }

    // Look for published date in ISO format
    if (obj.publishDate && typeof obj.publishDate === "string") {
      details.published = obj.publishDate;
    }

    // Handle dateText with simpleText format (e.g., "Oct 20, 2025")
    if (obj.dateText?.simpleText && !details.published) {
      const parsedDate = this.parseYouTubeDateText(obj.dateText.simpleText);
      if (parsedDate) {
        details.published = parsedDate;
      }
    }

    // Handle publishedTimeText
    if (obj.publishedTimeText?.simpleText && !details.published) {
      const parsedDate = this.parseYouTubeDateText(obj.publishedTimeText.simpleText);
      if (parsedDate) {
        details.published = parsedDate;
      }
    }

    // Recursively search
    for (const key in obj) {
      if (key === "thumbnail" || key === "thumbnails") continue; // Skip thumbnail objects to avoid deep recursion
      const nested = this.extractVideoDetailsFromYtData(obj[key]);
      if (Object.keys(nested).length > 0) {
        details.title = details.title || nested.title;
        details.channelId = details.channelId || nested.channelId;
        details.channelName = details.channelName || nested.channelName;
        details.channelHandle = details.channelHandle || nested.channelHandle;
        details.description = details.description || nested.description;
        details.viewCount = details.viewCount || nested.viewCount;
        details.likeCount = details.likeCount || nested.likeCount;
        details.published = details.published || nested.published;
      }
    }

    return details;
  }

  // --- 5. Get Transcript ---
  async getTranscript(videoId: string): Promise<TranscriptSegment[]> {
    try {
      const transcript = await fetchTranscript(videoId);

      return transcript.map((item: any) => ({
        text: decodeHtmlEntities(item.text),
        start: item.offset || item.start || 0,
        duration: item.duration,
      }));
    } catch (error) {
      console.error("Error fetching transcript:", error);
      return [];
    }
  }

  private formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  private parseYouTubeDateText(dateText: string): string | undefined {
    try {
      // Try parsing date formats like "Oct 20, 2025" or other common formats
      const date = new Date(dateText);

      // Check if the date is valid
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }

      return undefined;
    } catch (error) {
      console.error("Error parsing date text:", dateText, error);
      return undefined;
    }
  }

  private truncateDescription(description: string, maxLength: number = 150): string {
    if (!description || description.length <= maxLength) {
      return description;
    }

    // Find the last space before maxLength to avoid cutting words
    const truncated = description.slice(0, maxLength);
    const lastSpace = truncated.lastIndexOf(" ");

    // If there's a space, cut at the space; otherwise cut at maxLength
    const cutPoint = lastSpace > 0 ? lastSpace : maxLength;

    return description.slice(0, cutPoint).trim() + " ...";
  }

  private parseISO8601Duration(duration: string): string {
    // Parse ISO 8601 duration format (e.g., "PT4M13S" = 4 minutes 13 seconds)
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);

    if (!match) return "0:00";

    const hours = parseInt(match[1] || "0");
    const minutes = parseInt(match[2] || "0");
    const seconds = parseInt(match[3] || "0");

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }

    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }
}