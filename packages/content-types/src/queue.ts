export enum JobType {
  SCRAPE_PROFILE = "scrape_profile",
  SCRAPE_VIDEOS = "scrape_videos",
  SCRAPE_ALL_VIDEOS = "scrape_all_videos",
  DOWNLOAD_VIDEO = "download_video",
  EXTRACT_TRANSCRIPT = "extract_transcript",
  PREPARE_FOR_AI = "prepare_for_ai",
  GENERATE_EMBEDDINGS = "generate_embeddings",
}

export enum JobPriority {
  LOW = 3,
  NORMAL = 2,
  HIGH = 1,
  CRITICAL = 0,
}

export enum JobStatus {
  PENDING = "pending",
  ACTIVE = "active",
  COMPLETED = "completed",
  FAILED = "failed",
  DELAYED = "delayed",
  PAUSED = "paused",
}

export interface BaseJobData {
  type: JobType;
  platform: "instagram" | "youtube" | "tiktok";
  handle?: string;
  videoId?: string;
  metadata?: Record<string, unknown>;
}

export interface JobOptions {
  priority?: JobPriority;
  delay?: number;
  attempts?: number;
  backoff?: {
    type: "exponential" | "fixed";
    delay: number;
  };
  removeOnComplete?: boolean;
  removeOnFail?: boolean;
}

export interface JobResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  duration?: number;
  timestamp: Date;
}
