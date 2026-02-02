
export enum Severity {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  CRITICAL = 'CRITICAL'
}

export enum BugType {
  RACE_CONDITION = 'RACE_CONDITION',
  STATE_MANAGEMENT = 'STATE_MANAGEMENT',
  MEMORY_LEAK = 'MEMORY_LEAK',
  SECURITY = 'SECURITY',
  CRASH = 'CRASH',
  CORRUPTION = 'CORRUPTION',
  PERFORMANCE = 'PERFORMANCE',
  RESOURCE_LEAK = 'RESOURCE_LEAK',
  MERGE_CONFLICT = 'MERGE_CONFLICT',
  CODE_DUPLICATION = 'CODE_DUPLICATION',
  BREAKING_CHANGE = 'BREAKING_CHANGE',
  DEPENDENCY_ISSUE = 'DEPENDENCY_ISSUE',
  JS_SYNTAX_OPTIMIZATION = 'JS_SYNTAX_OPTIMIZATION'
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

export interface PRIssue {
  bug_description: string;
  severity: Severity;
  bug_type: BugType;
  file_name: string;
  line_numbers: string;
  snippet: string;
  suggested_fix: string;
  suggested_code: string;
  approval_status?: ApprovalStatus;
  rejection_reason?: string;
  prd_related?: boolean;
}

export interface ReviewResponse {
  issues: PRIssue[];
  performanceIssues?: PerformanceIssue[];
  breakingChanges?: BreakingChange[];
  duplications?: CodeDuplication[];
  dependencies?: DependencyIssue[];
  jsSyntaxImprovements?: JSSyntaxImprovement[];
}

export enum CommentCategory {
  CRITICAL_BUG = 'CRITICAL_BUG',
  NITPICK = 'NITPICK',
  OTHER = 'OTHER'
}

export interface CategorizedComment {
  comment_index: number | string;
  category: CommentCategory;
  reasoning: string;
}

export interface PerformanceIssue {
  type: 'O_N2' | 'O_N_LOG_N' | 'EXCESSIVE_RENDERS' | 'MEMORY_BLOAT' | 'BLOCKING_MAIN_THREAD' | 'LARGE_BUNDLE';
  severity: Severity;
  file_name: string;
  line_numbers: string;
  description: string;
  impact: string;
  optimization: string;
  js2026_alternative?: string;
  snippet: string;
  optimized_code: string;
}

export interface JSSyntaxImprovement {
  old_pattern: string;
  new_pattern: string;
  js2026_feature: string;
  benefit: string;
  file_name: string;
  line_numbers: string;
  old_code: string;
  new_code: string;
  description: string;
}

// Breaking Change Detection
export interface BreakingChange {
  type: 'API_REMOVAL' | 'TYPE_CHANGE' | 'SIGNATURE_CHANGE' | 'BEHAVIOR_CHANGE' | 'CONSTANT_REMOVAL';
  severity: Severity;
  file_name: string;
  line_numbers: string;
  description: string;
  impact: string;
  affected_consumers: string[];
  migration_path: string;
  code_before: string;
  code_after: string;
  semver_impact: 'MAJOR' | 'MINOR' | 'PATCH';
}

export interface CodeDuplication {
  duplicate_id: string;
  occurrences: {
    file_name: string;
    line_numbers: string;
    snippet: string;
  }[];
  similarity_score: number;
  description: string;
  suggestion: string;
  extracted_function?: string;
}

export interface DependencyIssue {
  type: 'VULNERABILITY' | 'OUTDATED' | 'LICENSE_ISSUE' | 'MAINTENANCE_WARNING';
  severity: Severity;
  package_name: string;
  current_version: string;
  recommended_version?: string;
  cve_id?: string;
  cve_severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  advisory_url?: string;
  fix_command: string;
  affected_files: string[];
}

export enum ReviewPresetType {
  STRICT = 'STRICT',
  MODERATE = 'MODERATE',
  LENIENT = 'LENIENT',
  SECURITY_FOCUSED = 'SECURITY_FOCUSED',
  PERFORMANCE_FOCUSED = 'PERFORMANCE_FOCUSED',
  CUSTOM = 'CUSTOM'
}

export interface ReviewPreset {
  id: string;
  name: string;
  type: ReviewPresetType;
  description: string;
  rules: ReviewRule[];
  enabled_checks: BugType[];
  severity_threshold: Severity;
  js2026_enabled: boolean;
  performance_analysis: boolean;
}

export interface ReviewRule {
  id: string;
  name: string;
  category: 'security' | 'performance' | 'maintainability' | 'style' | 'best_practices';
  enabled: boolean;
  severity?: Severity;
  custom_message?: string;
}

export interface TeamConfig {
  id: string;
  name: string;
  preset: ReviewPreset;
  custom_rules: ReviewRule[];
  ignore_patterns: string[];
  file_exclusions: string[];
}

export interface ReviewHistory {
  id: string;
  timestamp: number;
  pr_url: string;
  pr_number: number;
  pr_title: string;
  author: string;
  total_issues: number;
  issues_by_severity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  issues_by_type: Record<string, number>;
  approved_comments: number;
  rejected_comments: number;
  analysis_duration: number;
  model_used: string;
  review_preset?: string;
}

export interface ReviewAnalytics {
  total_reviews: number;
  average_issues_per_pr: number;
  most_common_issues: { type: string; count: number }[];
  trend_data: {
    date: string;
    issues_count: number;
  }[];
  performance_trend: {
    date: string;
    average_duration: number;
  }[];
  team_performance: {
    reviewer: string;
    reviews_count: number;
    average_approval_rate: number;
  }[];
}

export interface AnalysisProgress {
  stage: 'fetching' | 'analyzing' | 'categorizing' | 'complete';
  percentage: number;
  current_task: string;
  eta?: number;
  stages_completed: number;
  total_stages: number;
}

export interface ChunkProgress {
  currentChunk: number;
  totalChunks: number;
  currentFiles: string[];
  filesAnalyzed: number;
  totalFiles: number;
  issuesFound: number;
  status: 'preparing' | 'analyzing' | 'waiting' | 'complete' | 'error';
  elapsedMs?: number;
  estimatedRemainingMs?: number;
}

export interface ReviewLogEntry {
  timestamp: number;
  type: 'info' | 'success' | 'warning' | 'error' | 'progress';
  message: string;
  details?: {
    file?: string;
    chunk?: number;
    totalChunks?: number;
    issuesFound?: number;
    model?: string;
  };
}

export interface ExportOptions {
  format: 'markdown' | 'pdf' | 'json' | 'html';
  include_approved_only: boolean;
  include_rejected_only: boolean;
  include_metadata: boolean;
  include_statistics: boolean;
  template?: 'detailed' | 'summary' | 'minimal';
}

export interface ExportResult {
  content: string;
  filename: string;
  format: string;
  size: number;
}

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  action: () => void;
  description: string;
  category: 'navigation' | 'analysis' | 'review' | 'export' | 'theme';
}

export interface Command {
  id: string;
  label: string;
  description: string;
  action: () => void | Promise<void>;
  category: string;
  icon?: string;
  hotkey?: string;
}
