export type StorageProvider = "s3" | "minio" | "local";

export interface StorageOptions {
  provider: StorageProvider;
  bucket?: string;
  region?: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  publicUrl?: string;
}

export interface FileMetadata {
  key: string;
  url: string;
  size: number;
  contentType: string;
  uploadedAt: Date;
  etag?: string;
}

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  acl?: "private" | "public-read";
}
