export interface ChannelInfo {
  id: string;
  name: string;
  url: string;
  handle?: string;
  thumbnail?: string;
  description?: string;
}

export interface Video {
  id: string;
  title: string;
  description: string;
  published: string;
  thumbnail: string;
  length?: string; // e.g., "12:34"
  channelId: string;
  channelName: string;
}

export interface VideoInfo {
  id: string;
  title: string;
  description: string;
  published?: string;
  thumbnail: string;
  length?: string;
  channelId?: string;
  channelName?: string;
  channelHandle?: string;
  viewCount?: string;
  likeCount?: string;
  tags?: string[];
  url: string;
}

export interface VideoListResponse {
  videos: Video[];
  pageInfo: {
    totalResults?: number;
    resultsPerPage: number;
  };
  nextPageToken?: string;
  prevPageToken?: string;
}

export interface TranscriptSegment {
  text: string;
  start: number;
  duration: number;
}