export interface ProfileInfo {
  username: string;
  uniqueId?: string;
  nickname?: string;
  avatarUrl?: string;
  signature?: string;
  verified?: boolean;
  videoCount?: number;
  followerCount?: number;
  followingCount?: number;
  heartCount?: number; // Total likes across all videos
  privateAccount?: boolean;
}

export interface Video {
  id: string;
  platform: "tiktok";
  title?: string;
  description?: string;
  thumbnail?: string;
  published?: string; // ISO format
  url: string;
  channel?: {
    id: string;
    name: string;
    thumbnail?: string;
  };
  videoUrl?: string;
  duration?: number;
  stats?: {
    playCount?: number;
    likeCount?: number;
    commentCount?: number;
    shareCount?: number;
  };
}

export interface VideoInfo extends Video {
  author?: {
    username: string;
    nickname?: string;
    avatarUrl?: string;
    verified?: boolean;
  };
  hashtags?: string[];
  mentions?: string[];
  music?: {
    id?: string;
    title?: string;
    author?: string;
    url?: string;
  };
  transcript?: string; // WebVTT format transcript (optional)
}

export interface VideoListResponse {
  videos: Video[];
  pageInfo: {
    totalResults?: number;
    resultsPerPage: number;
  };
  nextPageToken?: string; // cursor for pagination (forward)
  prevPageToken?: string; // cursor for pagination (backward)
}

export interface TranscriptSegment {
  start: number;
  duration: number;
  text: string;
}
