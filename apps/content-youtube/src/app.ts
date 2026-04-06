/**
 * Hono app factory for YouTube scraper
 * Creates the YouTube scraper app with all routes and middleware
 */

import {
  ChannelIdResponseSchema,
  ChannelInfoSchema,
  ErrorResponseSchema,
  HandleQuerySchema,
  HealthCheckResponseSchema,
  ProfileQuerySchema,
  RecentVideosQuerySchema,
  TranscriptResponseSchema,
  VideoIdPathSchema,
  VideoInfoSchema,
  VideoListResponseSchema,
  VideosQuerySchema,
} from "./schemas";
import { OpenAPIHono, createRoute } from "@hono/zod-openapi";

import { Scalar } from "@scalar/hono-api-reference";
import { YouTubeService } from "./YouTubeService";

export interface AppEnv {
  PORT: string;
  YOUTUBE_API_KEY?: string;
  SERVER_URL?: string;
}

export function createApp(env: AppEnv) {
  const app = new OpenAPIHono();
  const youtubeService = new YouTubeService(env.YOUTUBE_API_KEY);

  // ===================================================================
  // MIDDLEWARE
  // ===================================================================

  // Request logging middleware
  app.use("*", async (c, next) => {
    const start = Date.now();
    const method = c.req.method;
    const path = c.req.path;

    await next();

    const duration = Date.now() - start;
    const status = c.res.status;
    const statusEmoji =
      status >= 200 && status < 300 ? "✓" : status >= 400 ? "✗" : "○";

    console.log(`${statusEmoji} ${method} ${path} - ${status} (${duration}ms)`);
  });

  // CORS middleware
  app.use("*", async (c, next) => {
    await next();
    c.res.headers.set("Access-Control-Allow-Origin", "*");
    c.res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    c.res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  });

  // ===================================================================
  // API DOCUMENTATION
  // ===================================================================

  app.doc("/openapi", {
    openapi: "3.1.0",
    info: {
      version: "1.0.0",
      title: "YouTube Scraper API",
      description: "A comprehensive API for scraping YouTube channel information, videos, and transcripts.",
    },
    servers: [
      {
        url: env.SERVER_URL || `http://localhost:${env.PORT}`,
        description: env.SERVER_URL ? "Production server" : "Development server",
      },
    ],
    tags: [
      {
        name: "Health",
        description: "Health check and service status",
      },
      {
        name: "Channel",
        description: "Channel information endpoints",
      },
      {
        name: "Videos",
        description: "Video listing and details endpoints",
      },
    ],
  });

  app.get(
    "/docs",
    Scalar({
      theme: "purple",
      pageTitle: "YouTube Scraper API",
      url: "/openapi",
    }) as any
  );

  // ===================================================================
  // HEALTH CHECK
  // ===================================================================

  const healthRoute = createRoute({
    method: "get",
    path: "/",
    tags: ["Health"],
    summary: "Health check",
    description: "Check if the service is running and get available endpoints",
    responses: {
      200: {
        description: "Service is healthy",
        content: {
          "application/json": {
            schema: HealthCheckResponseSchema,
          },
        },
      },
    },
  });

  app.openapi(healthRoute, (c) => {
    return c.json({
      status: "ok" as const,
      message: "YouTube Scraper API",
      version: "1.0.0",
    });
  });

  // ===================================================================
  // CHANNEL ENDPOINTS
  // ===================================================================

  const getChannelIdRoute = createRoute({
    method: "get",
    path: "/handle",
    tags: ["Channel"],
    summary: "Get channel ID",
    description: "Convert YouTube handle, username, or URL to channel ID",
    request: {
      query: HandleQuerySchema,
    },
    responses: {
      200: {
        description: "Channel ID resolved successfully",
        content: {
          "application/json": {
            schema: ChannelIdResponseSchema,
          },
        },
      },
      404: {
        description: "Unable to resolve channel ID",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
      500: {
        description: "Failed to get channel ID",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  });

  app.openapi(getChannelIdRoute, async (c) => {
    try {
      const { handle } = c.req.valid("query");
      const channelId = await youtubeService.getChannelId(handle);

      if (!channelId) {
        return c.json({ error: "Unable to resolve channel ID", details: "Channel not found" }, 404);
      }

      return c.json({ channelId }, 200);
    } catch (error) {
      return c.json(
        {
          error: "Failed to get channel ID",
          details: (error as Error).message,
        },
        500
      );
    }
  });

  const getChannelInfoRoute = createRoute({
    method: "get",
    path: "/profile",
    tags: ["Channel"],
    summary: "Get channel information",
    description: "Get detailed YouTube channel information",
    request: {
      query: ProfileQuerySchema,
    },
    responses: {
      200: {
        description: "Channel info retrieved successfully",
        content: {
          "application/json": {
            schema: ChannelInfoSchema,
          },
        },
      },
      404: {
        description: "Channel not found",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
      500: {
        description: "Failed to get channel info",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  });

  app.openapi(getChannelInfoRoute, async (c) => {
    try {
      const { handle } = c.req.valid("query");
      const channelId = await youtubeService.getChannelId(handle);

      if (!channelId) {
        return c.json({ error: "Unable to resolve channel ID", details: "Channel not found" }, 404);
      }

      const channelInfo = await youtubeService.getChannelInfo(channelId);
      return c.json(channelInfo, 200);
    } catch (error) {
      return c.json(
        {
          error: "Failed to get channel info",
          details: (error as Error).message,
        },
        500
      );
    }
  });

  // ===================================================================
  // VIDEO ENDPOINTS
  // ===================================================================

  const getRecentVideosRoute = createRoute({
    method: "get",
    path: "/videos/recent",
    tags: ["Videos"],
    summary: "Get recent videos",
    description: "Get recent ~15 videos from channel using RSS feed (no API key required)",
    request: {
      query: RecentVideosQuerySchema,
    },
    responses: {
      200: {
        description: "Videos retrieved successfully",
        content: {
          "application/json": {
            schema: VideoListResponseSchema,
          },
        },
      },
      500: {
        description: "Failed to get videos",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  });

  app.openapi(getRecentVideosRoute, async (c) => {
    try {
      const { handle } = c.req.valid("query");
      const result = await youtubeService.getRecentVideos(handle);
      return c.json(result, 200);
    } catch (error) {
      return c.json(
        {
          error: "Failed to get recent videos",
          details: (error as Error).message,
        },
        500
      );
    }
  });

  const getVideosRoute = createRoute({
    method: "get",
    path: "/videos",
    tags: ["Videos"],
    summary: "Get videos with pagination",
    description: "Get videos with pagination using YouTube API (requires API key)",
    request: {
      query: VideosQuerySchema,
    },
    responses: {
      200: {
        description: "Videos retrieved successfully",
        content: {
          "application/json": {
            schema: VideoListResponseSchema,
          },
        },
      },
      500: {
        description: "Failed to get videos",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  });

  app.openapi(getVideosRoute, async (c) => {
    try {
      const { handle, maxResults, pageToken, publishedAfter, publishedBefore, includeDuration } = c.req.valid("query");

      const result = await youtubeService.getVideos(handle, {
        pageToken,
        maxResults: maxResults ? parseInt(maxResults) : undefined,
        publishedAfter,
        publishedBefore,
        includeDuration: includeDuration === "true",
      });
      return c.json(result, 200);
    } catch (error) {
      return c.json(
        {
          error: "Failed to get videos",
          details: (error as Error).message,
        },
        500
      );
    }
  });

  const getVideoRoute = createRoute({
    method: "get",
    path: "/videos/{id}",
    tags: ["Videos"],
    summary: "Get video details",
    description: "Get detailed information about a specific video",
    request: {
      params: VideoIdPathSchema,
    },
    responses: {
      200: {
        description: "Video info retrieved successfully",
        content: {
          "application/json": {
            schema: VideoInfoSchema,
          },
        },
      },
      500: {
        description: "Failed to get video info",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  });

  app.openapi(getVideoRoute, async (c) => {
    try {
      const { id } = c.req.valid("param");
      const videoInfo = await youtubeService.getVideo(id);
      return c.json(videoInfo, 200);
    } catch (error) {
      return c.json(
        {
          error: "Failed to get video info",
          details: (error as Error).message,
        },
        500
      );
    }
  });

  const getTranscriptRoute = createRoute({
    method: "get",
    path: "/videos/{id}/transcript",
    tags: ["Videos"],
    summary: "Get video transcript",
    description: "Get transcript/captions for a video if available",
    request: {
      params: VideoIdPathSchema,
    },
    responses: {
      200: {
        description: "Transcript retrieved successfully",
        content: {
          "application/json": {
            schema: TranscriptResponseSchema,
          },
        },
      },
      404: {
        description: "No transcript available",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
      500: {
        description: "Failed to get transcript",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  });

  app.openapi(getTranscriptRoute, async (c) => {
    try {
      const { id } = c.req.valid("param");
      const transcript = await youtubeService.getTranscript(id);

      if (transcript.length === 0) {
        return c.json({ error: "No transcript available for this video", details: "Transcript not found" }, 404);
      }

      return c.json({ transcript }, 200);
    } catch (error) {
      return c.json(
        {
          error: "Failed to get transcript",
          details: (error as Error).message,
        },
        500
      );
    }
  });

  return app;
}
