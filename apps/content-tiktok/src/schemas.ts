/**
 * Zod schemas for OpenAPI documentation
 */
import { z } from "@hono/zod-openapi";

// ===================================================================
// REQUEST SCHEMAS (Query Parameters)
// ===================================================================

export const HandleQuerySchema = z.object({
  handle: z.string().openapi({
    description: "TikTok handle, username, or URL",
    example: "@username",
  }),
});

export const ProfileQuerySchema = z.object({
  handle: z.string().openapi({
    description: "TikTok handle or username",
    example: "@username",
  }),
});

export const VideosQuerySchema = z.object({
  handle: z.string().openapi({
    description: "TikTok handle or username",
    example: "@username",
  }),
  limit: z.string().optional().openapi({
    description: "Number of videos to fetch (max: 50)",
    example: "20",
  }),
  pageToken: z.string().optional().openapi({
    description: "Pagination cursor for next page",
    example: "1704463800000",
  }),
});

export const VideoIdPathSchema = z.object({
  id: z.string().openapi({
    description: "TikTok video ID",
    example: "1234567890",
  }),
});

export const TranscriptQuerySchema = z.object({
  language: z.string().optional().openapi({
    description: "Language code for transcript",
    example: "en",
  }),
});

// ===================================================================
// RESPONSE SCHEMAS
// ===================================================================

export const HandleResponseSchema = z.object({
  handle: z.string().openapi({
    description: "Resolved TikTok handle",
    example: "@username",
  }),
});

export const ProfileInfoSchema = z.object({
  username: z.string().openapi({
    description: "TikTok username",
    example: "username",
  }),
  uniqueId: z.string().optional().openapi({
    description: "Unique user ID",
    example: "@username",
  }),
  nickname: z.string().optional().openapi({
    description: "Display name/nickname",
    example: "John Doe",
  }),
  avatarUrl: z.string().url().optional().openapi({
    description: "Profile avatar URL",
    example: "https://p16-sign-sg.tiktokcdn.com/...",
  }),
  signature: z.string().optional().openapi({
    description: "Profile bio/signature",
    example: "Content creator",
  }),
  verified: z.boolean().optional().openapi({
    description: "Whether the account is verified",
    example: true,
  }),
  videoCount: z.number().optional().openapi({
    description: "Total number of videos",
    example: 150,
  }),
  followerCount: z.number().optional().openapi({
    description: "Number of followers",
    example: 1000000,
  }),
  followingCount: z.number().optional().openapi({
    description: "Number of accounts following",
    example: 100,
  }),
  heartCount: z.number().optional().openapi({
    description: "Total likes across all videos",
    example: 5000000,
  }),
  privateAccount: z.boolean().optional().openapi({
    description: "Whether the account is private",
    example: false,
  }),
});

export const ChannelSchema = z.object({
  id: z.string().openapi({
    description: "Channel/user ID",
    example: "6897654321",
  }),
  name: z.string().openapi({
    description: "Channel/user name",
    example: "username",
  }),
  thumbnail: z.string().url().optional().openapi({
    description: "Channel thumbnail URL",
    example: "https://p16-sign-sg.tiktokcdn.com/...",
  }),
});

export const VideoStatsSchema = z.object({
  playCount: z.number().optional().openapi({
    description: "Number of plays/views",
    example: 100000,
  }),
  likeCount: z.number().optional().openapi({
    description: "Number of likes",
    example: 5000,
  }),
  commentCount: z.number().optional().openapi({
    description: "Number of comments",
    example: 250,
  }),
  shareCount: z.number().optional().openapi({
    description: "Number of shares",
    example: 100,
  }),
});

export const VideoSchema = z.object({
  id: z.string().openapi({
    description: "Video ID",
    example: "1234567890",
  }),
  platform: z.literal("tiktok").openapi({
    description: "Platform identifier",
    example: "tiktok",
  }),
  title: z.string().optional().openapi({
    description: "Video title",
    example: "Amazing TikTok!",
  }),
  description: z.string().optional().openapi({
    description: "Video description/caption",
    example: "Check out this cool video #fyp",
  }),
  thumbnail: z.string().url().optional().openapi({
    description: "Video thumbnail URL",
    example: "https://p16-sign-sg.tiktokcdn.com/...",
  }),
  published: z.string().datetime().optional().openapi({
    description: "Publication date in ISO format",
    example: "2025-01-05T10:30:00.000Z",
  }),
  url: z.string().url().openapi({
    description: "TikTok video URL",
    example: "https://www.tiktok.com/@username/video/1234567890",
  }),
  channel: ChannelSchema.optional(),
  videoUrl: z.string().url().optional().openapi({
    description: "Direct video URL",
    example: "https://v16-webapp.tiktok.com/...",
  }),
  duration: z.number().optional().openapi({
    description: "Video duration in seconds",
    example: 30,
  }),
  stats: VideoStatsSchema.optional(),
});

export const VideoInfoSchema = VideoSchema.extend({
  author: z.object({
    username: z.string().openapi({
      description: "Author username",
      example: "username",
    }),
    nickname: z.string().optional().openapi({
      description: "Author nickname",
      example: "John Doe",
    }),
    avatarUrl: z.string().url().optional().openapi({
      description: "Author avatar URL",
      example: "https://p16-sign-sg.tiktokcdn.com/...",
    }),
    verified: z.boolean().optional().openapi({
      description: "Whether the author is verified",
      example: true,
    }),
  }).optional(),
  hashtags: z.array(z.string()).optional().openapi({
    description: "Hashtags from video",
    example: ["fyp", "tiktok"],
  }),
  mentions: z.array(z.string()).optional().openapi({
    description: "Mentioned usernames",
    example: ["user1", "user2"],
  }),
  music: z.object({
    id: z.string().optional().openapi({
      description: "Music ID",
      example: "123456",
    }),
    title: z.string().optional().openapi({
      description: "Music title",
      example: "Original Sound",
    }),
    author: z.string().optional().openapi({
      description: "Music author",
      example: "username",
    }),
    url: z.string().url().optional().openapi({
      description: "Music URL",
      example: "https://www.tiktok.com/music/...",
    }),
  }).optional(),
  transcript: z.string().optional().openapi({
    description: "Video transcript in WebVTT format",
    example: "WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nHello everyone!",
  }),
});

export const PageInfoSchema = z.object({
  totalResults: z.number().optional().openapi({
    description: "Total number of results available",
    example: 100,
  }),
  resultsPerPage: z.number().openapi({
    description: "Number of results per page",
    example: 20,
  }),
});

export const VideoListResponseSchema = z.object({
  videos: z.array(VideoSchema).openapi({
    description: "List of videos",
  }),
  pageInfo: PageInfoSchema,
  nextPageToken: z.string().optional().openapi({
    description: "Cursor for next page",
    example: "1704463800000",
  }),
  prevPageToken: z.string().optional().openapi({
    description: "Cursor for previous page",
    example: "1704463900000",
  }),
});

export const TranscriptSegmentSchema = z.object({
  start: z.number().openapi({
    description: "Start time in seconds",
    example: 0,
  }),
  duration: z.number().openapi({
    description: "Duration in seconds",
    example: 5.5,
  }),
  text: z.string().openapi({
    description: "Transcript text",
    example: "Hello everyone!",
  }),
});

export const TranscriptResponseSchema = z.object({
  transcript: z.string().openapi({
    description: "Video transcript in WebVTT format",
    example: "WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nHello everyone!\n\n00:00:05.000 --> 00:00:10.000\nWelcome to my video.",
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
    example: "TikTok Scraper API",
  }),
  version: z.string().openapi({
    description: "Service version",
    example: "1.0.0",
  }),
});

