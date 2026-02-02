import type { ReviewHistory, ReviewAnalytics, PRIssue } from '../types';

const DB_NAME = 'gear-pr-review-db';
const DB_VERSION = 1;
const STORE_NAME = 'review-history';

let db: IDBDatabase | null = null;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }
    
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('pr_url', 'pr_url', { unique: false });
        store.createIndex('author', 'author', { unique: false });
      }
    };
  });
};

export const saveReview = async (review: ReviewHistory): Promise<void> => {
  const database = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(review);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

export const getReview = async (id: string): Promise<ReviewHistory | null> => {
  const database = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
};

export const getAllReviews = async (): Promise<ReviewHistory[]> => {
  const database = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
};

export const getReviewsByDateRange = async (
  startDate: Date,
  endDate: Date
): Promise<ReviewHistory[]> => {
  const database = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('timestamp');
    const range = IDBKeyRange.bound(startDate.getTime(), endDate.getTime());
    const request = index.getAll(range);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
};

export const deleteReview = async (id: string): Promise<void> => {
  const database = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

export const clearAllReviews = async (): Promise<void> => {
  const database = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

export const createReviewHistory = (
  prUrl: string,
  prNumber: number,
  prTitle: string,
  author: string,
  issues: PRIssue[],
  analysisDuration: number,
  modelUsed: string,
  reviewPreset?: string
): ReviewHistory => {
  const issuesByType: Record<string, number> = {};
  for (const issue of issues) {
    issuesByType[issue.bug_type] = (issuesByType[issue.bug_type] || 0) + 1;
  }
  
  return {
    id: `review_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    timestamp: Date.now(),
    pr_url: prUrl,
    pr_number: prNumber,
    pr_title: prTitle,
    author,
    total_issues: issues.length,
    issues_by_severity: {
      critical: issues.filter(i => i.severity === 'CRITICAL').length,
      high: issues.filter(i => i.severity === 'HIGH').length,
      medium: issues.filter(i => i.severity === 'MEDIUM').length,
      low: issues.filter(i => i.severity === 'LOW').length,
    },
    issues_by_type: issuesByType,
    approved_comments: issues.filter(i => i.approval_status === 'approved').length,
    rejected_comments: issues.filter(i => i.approval_status === 'rejected').length,
    analysis_duration: analysisDuration,
    model_used: modelUsed,
    review_preset: reviewPreset,
  };
};

export const calculateAnalytics = async (): Promise<ReviewAnalytics> => {
  const reviews = await getAllReviews();
  
  if (reviews.length === 0) {
    return {
      total_reviews: 0,
      average_issues_per_pr: 0,
      most_common_issues: [],
      trend_data: [],
      performance_trend: [],
      team_performance: [],
    };
  }
  
  const totalIssues = reviews.reduce((sum, r) => sum + r.total_issues, 0);
  const averageIssues = totalIssues / reviews.length;
  
  const issueTypeCounts: Record<string, number> = {};
  for (const review of reviews) {
    for (const [type, count] of Object.entries(review.issues_by_type)) {
      issueTypeCounts[type] = (issueTypeCounts[type] || 0) + count;
    }
  }
  
  const mostCommonIssues = Object.entries(issueTypeCounts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  const reviewsByDate = new Map<string, ReviewHistory[]>();
  for (const review of reviews) {
    const date = new Date(review.timestamp).toISOString().split('T')[0];
    if (!reviewsByDate.has(date)) {
      reviewsByDate.set(date, []);
    }
    reviewsByDate.get(date)!.push(review);
  }
  
  const trendData = Array.from(reviewsByDate.entries())
    .map(([date, dayReviews]) => ({
      date,
      issues_count: dayReviews.reduce((sum, r) => sum + r.total_issues, 0),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  
  const performanceTrend = Array.from(reviewsByDate.entries())
    .map(([date, dayReviews]) => ({
      date,
      average_duration: dayReviews.reduce((sum, r) => sum + r.analysis_duration, 0) / dayReviews.length,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  
  const reviewerStats = new Map<string, { count: number; approved: number; total: number }>();
  for (const review of reviews) {
    const stats = reviewerStats.get(review.author) || { count: 0, approved: 0, total: 0 };
    stats.count++;
    stats.approved += review.approved_comments;
    stats.total += review.total_issues;
    reviewerStats.set(review.author, stats);
  }
  
  const teamPerformance = Array.from(reviewerStats.entries())
    .map(([reviewer, stats]) => ({
      reviewer,
      reviews_count: stats.count,
      average_approval_rate: stats.total > 0 ? stats.approved / stats.total : 0,
    }))
    .sort((a, b) => b.reviews_count - a.reviews_count);
  
  return {
    total_reviews: reviews.length,
    average_issues_per_pr: averageIssues,
    most_common_issues: mostCommonIssues,
    trend_data: trendData,
    performance_trend: performanceTrend,
    team_performance: teamPerformance,
  };
};

export const getRecentReviews = async (limit = 10): Promise<ReviewHistory[]> => {
  const reviews = await getAllReviews();
  return reviews
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
};

export const searchReviews = async (query: string): Promise<ReviewHistory[]> => {
  const reviews = await getAllReviews();
  const lower = query.toLowerCase();
  
  return reviews.filter(r => 
    r.pr_title.toLowerCase().includes(lower) ||
    r.pr_url.toLowerCase().includes(lower) ||
    r.author.toLowerCase().includes(lower)
  );
};
