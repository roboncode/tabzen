/**
 * Zod schemas for OpenAPI documentation
 */
import { z } from "@hono/zod-openapi";

// ===================================================================
// REQUEST SCHEMAS (Query Parameters)
// ===================================================================

export const HandleQuerySchema = z.object({
  handle: z.string().openapi({
    description: "YouTube handle, channel ID, or URL",
    example: "@username",
  }),
});

export const ProfileQuerySchema = z.object({
  handle: z.string().openapi({
    description: "YouTube handle, channel ID, or URL",
    example: "@username",
  }),
});

export const VideosQuerySchema = z.object({
  handle: z.string().openapi({
    description: "YouTube handle, channel ID, or URL",
    example: "@username",
  }),
  maxResults: z.string().optional().openapi({
    description: "Number of videos to fetch (1-50)",
    example: "25",
  }),
  pageToken: z.string().optional().openapi({
    description: "Pagination token for next page",
    example: "CDIQAA",
  }),
  publishedAfter: z.string().optional().openapi({
    description: "RFC3339 timestamp for filtering videos published after",
    example: "2025-01-01T00:00:00Z",
  }),
  publishedBefore: z.string().optional().openapi({
    description: "RFC3339 timestamp for filtering videos published before",
    example: "2025-12-31T23:59:59Z",
  }),
  includeDuration: z.string().optional().openapi({
    description: "Include video duration information (requires additional API call)",
    example: "true",
  }),
});

export const RecentVideosQuerySchema = z.object({
  handle: z.string().openapi({
    description: "YouTube handle, channel ID, or URL",
    example: "@username",
  }),
});

export const VideoIdPathSchema = z.object({
  id: z.string().openapi({
    description: "YouTube video ID",
    example: "dQw4w9WgXcQ",
  }),
});

// ===================================================================
// RESPONSE SCHEMAS
// ===================================================================

export const ChannelIdResponseSchema = z.object({
  channelId: z.string().openapi({
    description: "Resolved YouTube channel ID",
    example: "UCuAXFkgsw1L7xaCfnd5JJOw",
  }),
});

export const ChannelInfoSchema = z.object({
  id: z.string().openapi({
    description: "Channel ID",
    example: "UCuAXFkgsw1L7xaCfnd5JJOw",
  }),
  name: z.string().openapi({
    description: "Channel name",
    example: "Rick Astley",
  }),
  url: z.string().url().openapi({
    description: "Channel URL",
    example: "https://www.youtube.com/channel/UCuAXFkgsw1L7xaCfnd5JJOw",
  }),
  handle: z.string().optional().openapi({
    description: "Channel handle",
    example: "@RickAstley",
  }),
  thumbnail: z.string().url().optional().openapi({
    description: "Channel thumbnail URL",
    example: "https://yt3.googleusercontent.com/...",
  }),
  description: z.string().optional().openapi({
    description: "Channel description",
    example: "The official Rick Astley YouTube channel",
  }),
});

export const VideoSchema = z.object({
  id: z.string().openapi({
    description: "Video ID",
    example: "dQw4w9WgXcQ",
  }),
  title: z.string().openapi({
    description: "Video title",
    example: "Rick Astley - Never Gonna Give You Up",
  }),
  description: z.string().openapi({
    description: "Video description",
    example: "The official video for Rick Astley...",
  }),
  published: z.string().datetime().openapi({
    description: "Publication date in ISO format",
    example: "2009-10-25T06:57:33Z",
  }),
  thumbnail: z.string().url().openapi({
    description: "Video thumbnail URL",
    example: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  }),
  length: z.string().optional().openapi({
    description: "Video duration (HH:MM:SS or MM:SS)",
    example: "3:33",
  }),
  channelId: z.string().openapi({
    description: "Channel ID",
    example: "UCuAXFkgsw1L7xaCfnd5JJOw",
  }),
  channelName: z.string().openapi({
    description: "Channel name",
    example: "Rick Astley",
  }),
});

export const VideoInfoSchema = z.object({
  id: z.string().openapi({
    description: "Video ID",
    example: "dQw4w9WgXcQ",
  }),
  title: z.string().openapi({
    description: "Video title",
    example: "Rick Astley - Never Gonna Give You Up",
  }),
  description: z.string().openapi({
    description: "Video description",
    example: "The official video for Rick Astley...",
  }),
  published: z.string().datetime().optional().openapi({
    description: "Publication date in ISO format",
    example: "2009-10-25T06:57:33Z",
  }),
  thumbnail: z.string().url().openapi({
    description: "Video thumbnail URL",
    example: "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
  }),
  length: z.string().optional().openapi({
    description: "Video duration (HH:MM:SS or MM:SS)",
    example: "3:33",
  }),
  channelId: z.string().optional().openapi({
    description: "Channel ID",
    example: "UCuAXFkgsw1L7xaCfnd5JJOw",
  }),
  channelName: z.string().optional().openapi({
    description: "Channel name",
    example: "Rick Astley",
  }),
  channelHandle: z.string().optional().openapi({
    description: "Channel handle",
    example: "@RickAstley",
  }),
  viewCount: z.string().optional().openapi({
    description: "Number of views",
    example: "1500000000",
  }),
  likeCount: z.string().optional().openapi({
    description: "Number of likes",
    example: "15000000",
  }),
  tags: z.array(z.string()).optional().openapi({
    description: "Video tags",
    example: ["rick astley", "never gonna give you up", "music"],
  }),
  url: z.string().url().openapi({
    description: "Video URL",
    example: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  }),
});

export const PageInfoSchema = z.object({
  totalResults: z.number().optional().openapi({
    description: "Total number of results available",
    example: 100,
  }),
  resultsPerPage: z.number().openapi({
    description: "Number of results per page",
    example: 25,
  }),
});

export const VideoListResponseSchema = z.object({
  videos: z.array(VideoSchema).openapi({
    description: "List of videos",
  }),
  pageInfo: PageInfoSchema,
  nextPageToken: z.string().optional().openapi({
    description: "Token for fetching next page",
    example: "CDIQAA",
  }),
  prevPageToken: z.string().optional().openapi({
    description: "Token for fetching previous page",
    example: "CGQQAQ",
  }),
});

export const TranscriptSegmentSchema = z.object({
  text: z.string().openapi({
    description: "Transcript text",
    example: "Hello everyone!",
  }),
  start: z.number().openapi({
    description: "Start time in seconds",
    example: 0,
  }),
  duration: z.number().openapi({
    description: "Duration in seconds",
    example: 5.5,
  }),
});

export const TranscriptResponseSchema = z.object({
  transcript: z.array(TranscriptSegmentSchema).openapi({
    description: "Video transcript segments",
  }),
});

export const ErrorResponseSchema = z.object({
  error: z.string().openapi({
    description: "Error message",
    example: "Failed to fetch video",
  }),
  details: z.string().openapi({
    description: "Detailed error information",
    example: "Video not found",
  }),
});

export const HealthCheckResponseSchema = z.object({
  status: z.literal("ok").openapi({
    description: "Service status",
    example: "ok",
  }),
  message: z.string().openapi({
    description: "Service description",
    example: "YouTube Scraper API",
  }),
  version: z.string().openapi({
    description: "Service version",
    example: "1.0.0",
  }),
});

