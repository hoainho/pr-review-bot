import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  ExternalLink, 
  Trash2, 
  Search, 
  Calendar,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Filter,
  Download,
  BarChart3
} from 'lucide-react';
import type { ReviewHistory } from '../types';
import { getAllReviews, deleteReview, searchReviews } from '../services/reviewHistory';

interface ReviewHistoryListProps {
  onSelectReview: (review: ReviewHistory) => void;
  onRefresh?: () => void;
}

const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
};

const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};

export const ReviewHistoryList: React.FC<ReviewHistoryListProps> = ({ 
  onSelectReview,
  onRefresh 
}) => {
  const [reviews, setReviews] = useState<ReviewHistory[]>([]);
  const [filteredReviews, setFilteredReviews] = useState<ReviewHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | '7d' | '30d' | '90d'>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadReviews = async () => {
    setLoading(true);
    try {
      const data = await getAllReviews();
      const sorted = data.sort((a, b) => b.timestamp - a.timestamp);
      setReviews(sorted);
      setFilteredReviews(sorted);
    } catch (err) {
      console.error('Failed to load reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, []);

  useEffect(() => {
    let filtered = [...reviews];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        r.pr_title.toLowerCase().includes(query) ||
        r.pr_url.toLowerCase().includes(query) ||
        r.author.toLowerCase().includes(query)
      );
    }

    if (dateFilter !== 'all') {
      const now = Date.now();
      const days = dateFilter === '7d' ? 7 : dateFilter === '30d' ? 30 : 90;
      const cutoff = now - (days * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(r => r.timestamp >= cutoff);
    }

    setFilteredReviews(filtered);
  }, [searchQuery, dateFilter, reviews]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (deleteConfirm === id) {
      try {
        await deleteReview(id);
        setReviews(prev => prev.filter(r => r.id !== id));
        setDeleteConfirm(null);
        onRefresh?.();
      } catch (err) {
        console.error('Failed to delete review:', err);
      }
    } else {
      setDeleteConfirm(id);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const handleExport = () => {
    const data = JSON.stringify(filteredReviews, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `review-history-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getSeverityBadge = (count: number, type: 'critical' | 'high' | 'medium' | 'low') => {
    if (count === 0) return null;
    const colors = {
      critical: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
      high: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
      medium: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
      low: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    };
    return (
      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${colors[type]}`}>
        {count}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by title, URL, or author..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        
        <div className="flex gap-2">
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as typeof dateFilter)}
            className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All time</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          
          <button
            onClick={handleExport}
            disabled={filteredReviews.length === 0}
            className="px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {filteredReviews.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
          <BarChart3 className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">No reviews found</p>
          <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">
            {searchQuery ? 'Try a different search term' : 'Start analyzing PRs to build your history'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredReviews.map((review) => (
            <div
              key={review.id}
              onClick={() => onSelectReview(review)}
              className="group p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md cursor-pointer transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-slate-900 dark:text-slate-100 truncate">
                      {review.pr_title || 'Untitled PR'}
                    </h4>
                    <a
                      href={review.pr_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {formatRelativeTime(review.timestamp)}
                    </span>
                    <span>#{review.pr_number}</span>
                    <span>by {review.author}</span>
                    <span>{formatDuration(review.analysis_duration)}</span>
                    {review.review_preset && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        {review.review_preset}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    {getSeverityBadge(review.issues_by_severity.critical, 'critical')}
                    {getSeverityBadge(review.issues_by_severity.high, 'high')}
                    {getSeverityBadge(review.issues_by_severity.medium, 'medium')}
                    {getSeverityBadge(review.issues_by_severity.low, 'low')}
                    {review.total_issues === 0 && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                        Clean
                      </span>
                    )}
                  </div>

                  <button
                    onClick={(e) => handleDelete(review.id, e)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      deleteConfirm === review.id
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                        : 'text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-700 opacity-0 group-hover:opacity-100'
                    }`}
                    title={deleteConfirm === review.id ? 'Click again to confirm' : 'Delete review'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
                </div>
              </div>

              {review.approved_comments > 0 || review.rejected_comments > 0 ? (
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                  {review.approved_comments > 0 && (
                    <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {review.approved_comments} approved
                    </span>
                  )}
                  {review.rejected_comments > 0 && (
                    <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                      <XCircle className="w-3.5 h-3.5" />
                      {review.rejected_comments} rejected
                    </span>
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <div className="text-center text-xs text-slate-400 dark:text-slate-500 pt-2">
        Showing {filteredReviews.length} of {reviews.length} reviews
      </div>
    </div>
  );
};
