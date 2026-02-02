// Context caching service for performance optimization
// Caches learning contexts and repository analysis to avoid repeated API calls

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  key: string;
}

export interface CachedLearningContext {
  learningContext: any;
  prInfo: any;
  summary: string;
}

class ContextCache {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 30 * 60 * 1000; // 30 minutes

  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      key,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  clean(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  size(): number {
    return this.cache.size;
  }

  getStats(): { total: number; expired: number } {
    const now = Date.now();
    let expired = 0;
    
    for (const entry of this.cache.values()) {
      if (now - entry.timestamp > entry.ttl) {
        expired++;
      }
    }

    return {
      total: this.cache.size,
      expired,
    };
  }
}

// Global cache instance
const globalCache = new ContextCache();

export const generateCacheKey = (owner: string, repo: string, type: string, identifier?: string): string => {
  const parts = [owner, repo, type];
  if (identifier) parts.push(identifier);
  return parts.join(':');
};

export const cacheRepositoryContext = async (
  owner: string,
  repo: string,
  commitSha: string,
  context: any,
  ttl: number = 30 * 60 * 1000 // 30 minutes
): Promise<any> => {
  const key = generateCacheKey(owner, repo, 'repo-context', commitSha);
  
  if (globalCache.has(key)) {
    console.log(`[Cache] Repository context cache hit for ${commitSha.substring(0, 7)}`);
    return globalCache.get(key);
  }

  console.log(`[Cache] Repository context cache miss for ${commitSha.substring(0, 7)}`);
  globalCache.set(key, context, ttl);
  return context;
};

export const cacheLearningContext = async (
  owner: string,
  repo: string,
  pullNumber: number,
  learningContext: any,
  ttl: number = 60 * 60 * 1000 // 1 hour
): Promise<any> => {
  const key = generateCacheKey(owner, repo, 'learning-context', pullNumber.toString());
  
  if (globalCache.has(key)) {
    console.log(`[Cache] Learning context cache hit for PR #${pullNumber}`);
    return globalCache.get(key);
  }

  console.log(`[Cache] Learning context cache miss for PR #${pullNumber}`);
  globalCache.set(key, learningContext, ttl);
  return learningContext;
};

export const cacheFileContent = async (
  owner: string,
  repo: string,
  filePath: string,
  content: string,
  ttl: number = 60 * 60 * 1000 // 1 hour
): Promise<string> => {
  const key = generateCacheKey(owner, repo, 'file-content', filePath);
  
  if (globalCache.has(key)) {
    console.log(`[Cache] File content cache hit for ${filePath}`);
    return globalCache.get(key);
  }

  console.log(`[Cache] File content cache miss for ${filePath}`);
  globalCache.set(key, content, ttl);
  return content;
};

export const getCachedRepositoryContext = (
  owner: string,
  repo: string,
  commitSha: string
): any | null => {
  const key = generateCacheKey(owner, repo, 'repo-context', commitSha);
  return globalCache.get(key);
};

export const getCachedLearningContext = (
  owner: string,
  repo: string,
  pullNumber: number
): any | null => {
  const key = generateCacheKey(owner, repo, 'learning-context', pullNumber.toString());
  return globalCache.get(key);
};

export const invalidateCacheForRepo = (owner: string, repo: string): void => {
  const prefix = generateCacheKey(owner, repo, '');
  const keysToDelete: string[] = [];
  
  for (const key of globalCache['cache'].keys()) {
    if (key.startsWith(prefix)) {
      keysToDelete.push(key);
    }
  }
  
  keysToDelete.forEach(key => globalCache.delete(key));
  console.log(`[Cache] Invalidated ${keysToDelete.length} cache entries for ${owner}/${repo}`);
};

export const invalidateCacheForPR = (owner: string, repo: string, pullNumber: number): void => {
  const learningKey = generateCacheKey(owner, repo, 'learning-context', pullNumber.toString());
  globalCache.delete(learningKey);
  console.log(`[Cache] Invalidated learning cache for PR #${pullNumber}`);
};

export const getCacheStats = () => {
  return globalCache.getStats();
};

export const clearAllCache = (): void => {
  globalCache.clear();
  console.log('[Cache] Cleared all cache entries');
};

// Auto-cleanup expired entries every 5 minutes
setInterval(() => {
  globalCache.clean();
}, 5 * 60 * 1000);