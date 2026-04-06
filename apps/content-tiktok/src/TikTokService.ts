import {
  ProfileInfo,
  Video,
  VideoInfo,
  VideoListResponse,
  TranscriptSegment,
} from "./models";
import { TikTokResolver } from "./TikTokResolver";
import { ScraperAPIService } from "./ScraperAPIService";
import { decodeHtmlEntities } from "@tab-zen/content-types";

export class TikTokService {
  private resolver: TikTokResolver;
  private scraperAPI?: ScraperAPIService;

  constructor(scraperAPIKey?: string) {
    this.resolver = new TikTokResolver();
    if (scraperAPIKey) {
      this.scraperAPI = new ScraperAPIService(scraperAPIKey);
    }
  }

  // --- 1. Resolve Handle ---
  async getHandle(input: string): Promise<string | null> {
    return this.resolver.resolveHandle(input);
  }

  // --- 2. Get Profile Info ---
  async getProfileInfo(input: string): Promise<ProfileInfo> {
    const handle = await this.getHandle(input);
    if (!handle) throw new Error("Unable to resolve handle");

    if (!this.scraperAPI) {
      throw new Error("ScraperAPI key is required for profile info");
    }

    try {
      // API doesn't want @ symbol
      const cleanHandle = handle.replace(/^@/, "");
      const scraperData = await this.scraperAPI.getProfile(cleanHandle);

      // API returns { user: {...}, stats: {...} }
      const user = scraperData.user || scraperData;
      const stats = scraperData.stats || scraperData.statsV2 || {};

      return {
        username: user.uniqueId || user.username || handle.replace(/^@/, ""),
        uniqueId: user.uniqueId,
        nickname: user.nickname || user.displayName,
        avatarUrl: user.avatarLarger || user.avatarMedium || user.avatarThumb || user.avatarUrl || user.avatar_url,
        signature: user.signature || user.bio,
        verified: user.verified || user.isVerified,
        videoCount: stats.videoCount || user.videoCount || user.video_count,
        followerCount: stats.followerCount || user.followerCount || user.follower_count,
        followingCount: stats.followingCount || user.followingCount || user.following_count,
        heartCount: stats.heartCount || stats.heart || user.heartCount || user.heart_count || user.likes,
        privateAccount: user.privateAccount || user.is_private || user.secret,
      };
    } catch (error) {
      console.error("Error fetching profile info:", error);
      throw new Error("Unable to fetch profile information");
    }
  }

  // --- 3. Get Videos with Pagination ---
  async getVideos(
    input: string,
    limit: number = 20,
    pageToken?: string
  ): Promise<VideoListResponse> {
    const handle = await this.getHandle(input);
    if (!handle) throw new Error("Unable to resolve handle");

    if (!this.scraperAPI) {
      throw new Error("ScraperAPI key is required for videos");
    }

    try {
      // API doesn't want @ symbol
      const cleanHandle = handle.replace(/^@/, "");
      const scraperData = await this.scraperAPI.getVideos(cleanHandle, limit, pageToken);

      // API returns { aweme_list: [], min_cursor, max_cursor, has_more }
      if (!scraperData?.aweme_list || scraperData.aweme_list.length === 0) {
        return {
          videos: [],
          pageInfo: {
            resultsPerPage: 0,
          },
        };
      }

      const items = scraperData.aweme_list || [];
      const videos: Video[] = items.map((item: any) => this.parseVideo(item));

      // Extract pagination cursors
      // max_cursor is used as nextPageToken (go forward in time)
      // min_cursor is used as prevPageToken (go backward in time)
      const nextPageToken = scraperData.has_more === 1 ? scraperData.max_cursor?.toString() : undefined;
      const prevPageToken = scraperData.min_cursor?.toString();

      return {
        videos,
        pageInfo: {
          resultsPerPage: videos.length,
        },
        nextPageToken,
        prevPageToken,
      };
    } catch (error) {
      console.error("Error fetching videos via ScraperAPI:", error);
      throw new Error("Unable to fetch videos");
    }
  }

  // --- 4. Get Video Info ---
  async getVideoInfo(videoId: string, includeTranscript: boolean = false): Promise<VideoInfo> {
    if (!this.scraperAPI) {
      throw new Error("ScraperAPI key is required for video info");
    }

    try {
      // Construct TikTok video URL from ID
      const videoUrl = `https://www.tiktok.com/video/${videoId}`;

      const scraperData = await this.scraperAPI.getVideo(videoUrl, includeTranscript);

      // Extract aweme_detail which contains the video data
      const videoData = scraperData.aweme_detail || scraperData;
      const video = this.parseVideo(videoData);
      const description = videoData.desc || videoData.description || "";

      return {
        ...video,
        author: videoData.author ? {
          username: videoData.author.unique_id || videoData.author.uniqueId || videoData.author.username,
          nickname: videoData.author.nickname || videoData.author.displayName,
          avatarUrl: this.findBestImageUrl(videoData.author.avatar_larger?.url_list) ||
                    this.findBestImageUrl(videoData.author.avatar_medium?.url_list) ||
                    videoData.author.avatarUrl ||
                    videoData.author.avatar_url,
          verified: videoData.author.verified || videoData.author.is_verified || videoData.author.isVerified,
        } : undefined,
        hashtags: description ? this.extractHashtags(description) : undefined,
        mentions: description ? this.extractMentions(description) : undefined,
        music: videoData.music ? {
          id: videoData.music.id,
          title: videoData.music.title || videoData.music.name,
          author: videoData.music.authorName || videoData.music.author,
          url: videoData.music.playUrl || videoData.music.url,
        } : undefined,
        // Include transcript if requested and available (comes as WebVTT string)
        transcript: includeTranscript && scraperData.transcript ? scraperData.transcript : undefined,
      };
    } catch (error) {
      console.error("Error fetching video info:", error);
      throw new Error("Unable to fetch video information");
    }
  }

  // --- 5. Get Transcript ---
  async getTranscript(videoUrl: string, language: string = "en"): Promise<string> {
    if (!this.scraperAPI) {
      throw new Error("ScraperAPI key is required for transcripts");
    }

    try {
      const scraperData = await this.scraperAPI.getTranscript(videoUrl);

      // API returns { id, url, transcript } where transcript is WebVTT string
      if (scraperData?.transcript && typeof scraperData.transcript === 'string') {
        return scraperData.transcript;
      }

      return "";
    } catch (error) {
      console.error("Error fetching transcript:", error);
      throw new Error("Unable to fetch transcript");
    }
  }

  // --- Helper Methods ---

  /**
   * Find the best image URL from a url_list, preferring JPEG/WEBP over HEIC
   * HEIC (High Efficiency Image Format) has limited browser support
   */
  private findBestImageUrl(urlList?: string[]): string | undefined {
    if (!urlList || urlList.length === 0) return undefined;

    // Prefer JPEG or WEBP formats over HEIC for better browser compatibility
    const jpegUrl = urlList.find(url => url.includes('.jpeg') || url.includes('.jpg'));
    if (jpegUrl) return jpegUrl;

    const webpUrl = urlList.find(url => url.includes('.webp') || url.includes('.awebp'));
    if (webpUrl) return webpUrl;

    // Fall back to first URL if no JPEG/WEBP found
    return urlList[0];
  }

  private parseVideo(item: any): Video {
    const description = item.desc || item.description || item.title || "";
    const videoId = item.aweme_id || item.id || item.video_id;
    const authorUsername = item.author?.unique_id || item.author?.uniqueId || item.author?.username;

    // Construct TikTok URL from share_url or build it
    const url = item.share_url || item.url ||
                (videoId && authorUsername ? `https://www.tiktok.com/@${authorUsername}/video/${videoId}` : "");

    // Convert Unix timestamp to ISO format
    const createdAt = item.create_time || item.createTime || item.created_at;
    const published = createdAt ? new Date(createdAt * 1000).toISOString() : undefined;

    // Get video cover - prefer JPEG/WEBP over HEIC for browser compatibility
    // Priority: cover (300x400) > origin_cover (360p) > dynamic_cover (248x330)
    const coverUrl = this.findBestImageUrl(item.video?.cover?.url_list) ||
                     this.findBestImageUrl(item.video?.origin_cover?.url_list) ||
                     this.findBestImageUrl(item.video?.dynamic_cover?.url_list) ||
                     item.cover ||
                     item.thumbnail;

    // Get video play URL from video.play_addr
    const playUrl = item.video?.play_addr?.url_list?.[0] ||
                   item.playAddr ||
                   item.play_url;

    // Duration is in milliseconds
    const durationMs = item.video?.duration || item.duration;
    const durationSeconds = durationMs ? Math.floor(durationMs / 1000) : undefined;

    // Get stats from statistics object
    const stats = item.statistics || {};

    return {
      id: videoId,
      platform: "tiktok",
      title: description.slice(0, 100) || undefined,
      description,
      thumbnail: coverUrl,
      published,
      url,
      channel: item.author ? {
        id: item.author.uid || item.author.id,
        name: item.author.unique_id || item.author.uniqueId || item.author.username,
        thumbnail: this.findBestImageUrl(item.author.avatar_larger?.url_list) ||
                  this.findBestImageUrl(item.author.avatar_medium?.url_list) ||
                  item.author.avatarUrl ||
                  item.author.avatar_url,
      } : undefined,
      videoUrl: playUrl,
      duration: durationSeconds,
      stats: {
        playCount: stats.play_count || item.playCount || item.play_count,
        likeCount: stats.digg_count || item.diggCount || item.like_count,
        commentCount: stats.comment_count || item.commentCount || item.comment_count,
        shareCount: stats.share_count || item.shareCount || item.share_count,
      },
    };
  }

  private extractHashtags(text: string): string[] {
    const hashtagRegex = /#[\w\u00C0-\u017F]+/g;
    const hashtags = text.match(hashtagRegex) || [];
    return [...new Set(hashtags.map((tag) => tag.slice(1)))];
  }

  private extractMentions(text: string): string[] {
    const mentionRegex = /@[\w.]+/g;
    const mentions = text.match(mentionRegex) || [];
    return [...new Set(mentions.map((mention) => mention.slice(1)))];
  }
}
