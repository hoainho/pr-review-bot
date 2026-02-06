import React from 'react';
import { 
  X, 
  ExternalLink, 
  Clock, 
  User, 
  GitBranch,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  BarChart3,
  Zap,
  Shield,
  Bug,
  Cpu,
  RefreshCw
} from 'lucide-react';
import type { ReviewHistory } from '../types';

interface ReviewHistoryDetailProps {
  review: ReviewHistory;
  onClose: () => void;
  onReanalyze?: (prUrl: string) => void;
}

const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};

const BUG_TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  RACE_CONDITION: { label: 'Race Condition', icon: <Zap className="w-3.5 h-3.5" />, color: 'text-amber-600 dark:text-amber-400' },
  STATE_MANAGEMENT: { label: 'State Management', icon: <GitBranch className="w-3.5 h-3.5" />, color: 'text-blue-600 dark:text-blue-400' },
  MEMORY_LEAK: { label: 'Memory Leak', icon: <Cpu className="w-3.5 h-3.5" />, color: 'text-red-600 dark:text-red-400' },
  SECURITY: { label: 'Security', icon: <Shield className="w-3.5 h-3.5" />, color: 'text-purple-600 dark:text-purple-400' },
  CRASH: { label: 'Crash Risk', icon: <AlertTriangle className="w-3.5 h-3.5" />, color: 'text-red-600 dark:text-red-400' },
  CORRUPTION: { label: 'Data Corruption', icon: <AlertTriangle className="w-3.5 h-3.5" />, color: 'text-red-600 dark:text-red-400' },
  PERFORMANCE: { label: 'Performance', icon: <Zap className="w-3.5 h-3.5" />, color: 'text-amber-600 dark:text-amber-400' },
  RESOURCE_LEAK: { label: 'Resource Leak', icon: <Cpu className="w-3.5 h-3.5" />, color: 'text-orange-600 dark:text-orange-400' },
  BREAKING_CHANGE: { label: 'Breaking Change', icon: <AlertTriangle className="w-3.5 h-3.5" />, color: 'text-red-600 dark:text-red-400' },
  CODE_DUPLICATION: { label: 'Code Duplication', icon: <Bug className="w-3.5 h-3.5" />, color: 'text-slate-600 dark:text-slate-400' },
  JS_SYNTAX_OPTIMIZATION: { label: 'JS Optimization', icon: <Zap className="w-3.5 h-3.5" />, color: 'text-emerald-600 dark:text-emerald-400' },
};

export const ReviewHistoryDetail: React.FC<ReviewHistoryDetailProps> = ({ 
  review, 
  onClose,
  onReanalyze 
}) => {
  const totalIssues = review.total_issues;
  const severityData = [
    { label: 'Critical', count: review.issues_by_severity.critical, color: 'bg-purple-500' },
    { label: 'High', count: review.issues_by_severity.high, color: 'bg-red-500' },
    { label: 'Medium', count: review.issues_by_severity.medium, color: 'bg-amber-500' },
    { label: 'Low', count: review.issues_by_severity.low, color: 'bg-blue-500' },
  ].filter(s => s.count > 0);

  const issueTypes = Object.entries(review.issues_by_type)
    .map(([type, count]) => ({
      type,
      count: count as number,
      ...(BUG_TYPE_LABELS[type] || { label: type, icon: <Bug className="w-3.5 h-3.5" />, color: 'text-slate-600' }),
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Review Details</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {review.pr_title || 'Untitled PR'}
                </h3>
                <a
                  href={review.pr_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-indigo-600 dark:text-indigo-400 hover:underline mt-1"
                >
                  View on GitHub
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              <span className="px-3 py-1 text-sm font-medium rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                #{review.pr_number}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <User className="w-4 h-4" />
                {review.author}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {formatDate(review.timestamp)}
              </span>
              <span className="flex items-center gap-1.5">
                <Zap className="w-4 h-4" />
                {formatDuration(review.analysis_duration)}
              </span>
            </div>

            {review.review_preset && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400">
                Preset: {review.review_preset}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl text-center">
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalIssues}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Total Issues</p>
            </div>
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-center">
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{review.approved_comments}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Approved</p>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl text-center">
              <p className="text-2xl font-bold text-slate-600 dark:text-slate-400">{review.rejected_comments}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Rejected</p>
            </div>
            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-center">
              <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                {totalIssues > 0 ? Math.round((review.approved_comments / totalIssues) * 100) : 0}%
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Approval Rate</p>
            </div>
          </div>

          {severityData.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Issues by Severity</h4>
              <div className="space-y-2">
                {severityData.map(({ label, count, color }) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="w-16 text-xs text-slate-600 dark:text-slate-400">{label}</span>
                    <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${color} rounded-full transition-all`}
                        style={{ width: `${(count / totalIssues) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 text-xs font-medium text-slate-700 dark:text-slate-300 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {issueTypes.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Issues by Type</h4>
              <div className="flex flex-wrap gap-2">
                {issueTypes.map(({ type, count, label, icon, color }) => (
                  <div
                    key={type}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800"
                  >
                    <span className={color}>{icon}</span>
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{label}</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Analysis Info</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500 dark:text-slate-400">Model Used</p>
                <p className="font-medium text-slate-700 dark:text-slate-300">{review.model_used || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">Duration</p>
                <p className="font-medium text-slate-700 dark:text-slate-300">{formatDuration(review.analysis_duration)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          {onReanalyze && (
            <button
              onClick={() => onReanalyze(review.pr_url)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Re-analyze PR
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
