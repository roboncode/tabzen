export interface CacheOptions {
  useCache?: boolean;
  ttl?: number;
  forceRefresh?: boolean;
  prefix?: string;
}

export interface CacheEntry<T = unknown> {
  key: string;
  data: T;
  createdAt: Date;
  expiresAt: Date;
  size?: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  totalEntries: number;
  expiredEntries: number;
  activeEntries: number;
  totalSize: number;
  platform?: string;
}
