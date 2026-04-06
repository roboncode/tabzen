/**
 * Hono app factory for TikTok scraper
 * Creates the TikTok scraper app with all routes and middleware
 */

import {
  ErrorResponseSchema,
  HandleQuerySchema,
  HandleResponseSchema,
  HealthCheckResponseSchema,
  ProfileInfoSchema,
  ProfileQuerySchema,
  TranscriptQuerySchema,
  TranscriptResponseSchema,
  VideoIdPathSchema,
  VideoInfoSchema,
  VideoListResponseSchema,
  VideosQuerySchema,
} from "./schemas";
import { OpenAPIHono, createRoute } from "@hono/zod-openapi";

import { Scalar } from "@scalar/hono-api-reference";
import { TikTokService } from "./TikTokService";
import { z } from "@hono/zod-openapi";

export interface AppEnv {
  PORT: string;
  SCRAPER_API_KEY?: string;
  SERVER_URL?: string;
}

export function createApp(env: AppEnv) {
  const app = new OpenAPIHono();
  const tiktokService = new TikTokService(env.SCRAPER_API_KEY);

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
      title: "TikTok Scraper API",
      description: "A comprehensive API for scraping TikTok profile information, videos, and transcripts.",
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
        name: "Profile",
        description: "Profile information endpoints",
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
      pageTitle: "TikTok Scraper API",
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
      message: "TikTok Scraper API",
      version: "1.0.0",
    });
  });

  // ===================================================================
  // PROFILE ENDPOINTS
  // ===================================================================

  const resolveHandleRoute = createRoute({
    method: "get",
    path: "/handle",
    tags: ["Profile"],
    summary: "Resolve TikTok handle",
    description: "Convert various TikTok handle formats to a normalized handle",
    request: {
      query: HandleQuerySchema,
    },
    responses: {
      200: {
        description: "Handle resolved successfully",
        content: {
          "application/json": {
            schema: HandleResponseSchema,
          },
        },
      },
      404: {
        description: "Unable to resolve handle",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
      500: {
        description: "Failed to resolve handle",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  });

  app.openapi(resolveHandleRoute, async (c) => {
    try {
      const { handle } = c.req.valid("query");
      const resolvedHandle = await tiktokService.getHandle(handle);

      if (!resolvedHandle) {
        return c.json({ error: "Unable to resolve handle", details: "Handle not found" }, 404);
      }

      return c.json({ handle: resolvedHandle }, 200);
    } catch (error) {
      return c.json(
        {
          error: "Failed to resolve handle",
          details: (error as Error).message,
        },
        500
      );
    }
  });

  const getProfileRoute = createRoute({
    method: "get",
    path: "/profile",
    tags: ["Profile"],
    summary: "Get profile information",
    description: "Get detailed TikTok profile information",
    request: {
      query: ProfileQuerySchema,
    },
    responses: {
      200: {
        description: "Profile retrieved successfully",
        content: {
          "application/json": {
            schema: ProfileInfoSchema,
          },
        },
      },
      503: {
        description: "ScraperAPI key required",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
      500: {
        description: "Failed to get profile",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  });

  app.openapi(getProfileRoute, async (c) => {
    if (!env.SCRAPER_API_KEY) {
      return c.json(
        { error: "ScraperAPI key is required for this endpoint", details: "Configure SCRAPER_API_KEY" },
        503
      );
    }

    try {
      const { handle } = c.req.valid("query");
      const profileInfo = await tiktokService.getProfileInfo(handle);
      return c.json(profileInfo, 200);
    } catch (error) {
      return c.json(
        {
          error: "Failed to get profile info",
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
    description: "Get recent 20 videos",
    request: {
      query: HandleQuerySchema,
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
      503: {
        description: "ScraperAPI key required",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
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
    if (!env.SCRAPER_API_KEY) {
      return c.json(
        { error: "ScraperAPI key is required for this endpoint", details: "Configure SCRAPER_API_KEY" },
        503
      );
    }

    try {
      const { handle } = c.req.valid("query");
      const result = await tiktokService.getVideos(handle, 20);
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

  const getVideosRoute = createRoute({
    method: "get",
    path: "/videos",
    tags: ["Videos"],
    summary: "Get videos with pagination",
    description: "Get videos with pagination",
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
      503: {
        description: "ScraperAPI key required",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
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
    if (!env.SCRAPER_API_KEY) {
      return c.json(
        { error: "ScraperAPI key is required for this endpoint", details: "Configure SCRAPER_API_KEY" },
        503
      );
    }

    try {
      const { handle, limit, pageToken } = c.req.valid("query");
      const parsedLimit = limit ? parseInt(limit) : 20;

      const result = await tiktokService.getVideos(handle, parsedLimit, pageToken);
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

  const getVideoInfoRoute = createRoute({
    method: "get",
    path: "/videos/{id}",
    tags: ["Videos"],
    summary: "Get video details",
    description: "Get detailed information about a specific video",
    request: {
      params: VideoIdPathSchema,
      query: z.object({
        transcript: z.string().optional().openapi({
          description: "Include transcript in response",
          example: "true",
        }),
      }),
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
      503: {
        description: "ScraperAPI key required",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
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

  app.openapi(getVideoInfoRoute, async (c) => {
    if (!env.SCRAPER_API_KEY) {
      return c.json(
        { error: "ScraperAPI key is required for this endpoint", details: "Configure SCRAPER_API_KEY" },
        503
      );
    }

    try {
      const { id } = c.req.valid("param");
      const { transcript } = c.req.valid("query");
      const includeTranscript = transcript === "true";

      const videoInfo = await tiktokService.getVideoInfo(id, includeTranscript);
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
    description: "Get transcript/captions for a video",
    request: {
      params: VideoIdPathSchema,
      query: TranscriptQuerySchema,
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
      503: {
        description: "ScraperAPI key required",
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
    if (!env.SCRAPER_API_KEY) {
      return c.json(
        { error: "ScraperAPI key is required for this endpoint", details: "Configure SCRAPER_API_KEY" },
        503
      );
    }

    try {
      const { id } = c.req.valid("param");
      const { language } = c.req.valid("query");

      const videoInfo = await tiktokService.getVideoInfo(id, false);
      const transcript = await tiktokService.getTranscript(videoInfo.url, language || "en");

      if (!transcript || transcript.length === 0) {
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
