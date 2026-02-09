import React, { useState, useEffect, useCallback, useRef } from 'react';
import { analyzeDiff } from './services/aiService';
import { fetchPrDiff, submitPrReview, parseGitHubUrl, fetchPRInfoFromUrl, checkMergeConflicts } from './services/githubService';
import { PRIssue, Severity, ApprovalStatus, BugType, AnalysisProgress, ExportOptions, ReviewPreset, ReviewAnalytics, ReviewLogEntry, ReviewHistory } from './types';
import { ReviewTerminal } from './components/ReviewTerminal';
import { RequirementTooltip } from './components/RequirementTooltip';
import { ReviewHistoryList } from './components/ReviewHistoryList';
import { ReviewHistoryDetail } from './components/ReviewHistoryDetail';
import { LoginScreen } from './components/LoginScreen';
import { DocumentationPage } from './components/DocumentationPage';
import { SecurityPage } from './components/SecurityPage';
import { SupportPage } from './components/SupportPage';
import { useAuth } from './contexts/AuthContext';
import type { GitHubMCPContext } from './services/githubMCPContext';
import type { JiraConfluenceContext } from './services/jiraConfluenceMCP';
import { initTheme, toggleTheme, getThemeConfig } from './services/darkMode';
import { exportReview, downloadExport } from './services/exportService';
import { ProgressTracker, formatETA } from './services/progressTracker';
import { initKeyboardShortcuts, registerDefaultShortcuts, destroyKeyboardShortcuts } from './services/keyboardShortcuts';
import { analyzeDiffForPerformance, generatePerformancePromptSection } from './services/performanceAnalyzer';
import { analyzeBreakingChangesFromDiff, generateBreakingChangeReport } from './services/breakingChangeDetector';
import { analyzeDiffForDuplication, generateDuplicationReport } from './services/codeDuplicationDetector';
import { getAllPresets, BUILTIN_PRESETS } from './services/reviewPresets';
import { calculateAnalytics, getRecentReviews } from './services/reviewHistory';
import { 
  ShieldAlert, 
  Terminal, 
  Bug, 
  CheckCircle2, 
  AlertTriangle, 
  Info,
  Loader2,
  Code2,
  Github,
  Wand2,
  Sparkles,
  Link,
  Key,
  Send,
  ExternalLink,
  Check,
  X,
  Eye,
  Filter,
  Calendar,
  Moon,
  Sun,
  Monitor,
  Download,
  Keyboard,
  Zap,
  GitBranch,
  Copy,
  BarChart3,
  Settings,
  TrendingUp,
  Clock,
  ChevronDown,
  ChevronUp,
  Activity,
  LogOut
} from 'lucide-react';

const renderTextWithCode = (text: string): React.ReactNode => {
  if (!text) return null;
  const parts = text.split(/`([^`]+)`/g);
  return parts.map((part, index) => 
    index % 2 === 1 ? (
      <code key={index} className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 rounded text-sm font-mono">
        {part}
      </code>
    ) : part
  );
};

const App: React.FC = () => {
  const { user, isLoading: authLoading, isConfigured: authConfigured, signOut } = useAuth();

  const [githubUrl, setGithubUrl] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [results, setResults] = useState<PRIssue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [useGitHubContext, setUseGitHubContext] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [enableLearning, setEnableLearning] = useState(true);
  const [enableFormulaComments, setEnableFormulaComments] = useState(true);
  const [enableCache, setEnableCache] = useState(true);
  
  const [jiraBaseUrl, setJiraBaseUrl] = useState('');
  const [jiraEmail, setJiraEmail] = useState('');
  const [jiraToken, setJiraToken] = useState('');
  const [confluenceBaseUrl, setConfluenceBaseUrl] = useState('');
  
  const [useJiraConfluenceContext, setUseJiraConfluenceContext] = useState(false);

  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [enableJS2026, setEnableJS2026] = useState(true);
  const [enablePerformanceAnalysis, setEnablePerformanceAnalysis] = useState(true);
  const [currentIssueIndex, setCurrentIssueIndex] = useState(0);
  const [analysisStartTime, setAnalysisStartTime] = useState<number | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<ReviewPreset | null>(BUILTIN_PRESETS[1]);
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);
  const [analytics, setAnalytics] = useState<ReviewAnalytics | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [selectedHistoryReview, setSelectedHistoryReview] = useState<ReviewHistory | null>(null);
  const [showHistoryTab, setShowHistoryTab] = useState<'summary' | 'history'>('summary');
  const [reviewLogs, setReviewLogs] = useState<ReviewLogEntry[]>([]);
  const [currentReviewFile, setCurrentReviewFile] = useState<string | undefined>();
  const [chunkProgress, setChunkProgress] = useState<{ current: number; total: number; percentage: number } | undefined>();
  const [isPaused, setIsPaused] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const pauseRef = useRef(false);
  const cancelRef = useRef(false);
  const [currentPage, setCurrentPage] = useState<'main' | 'docs' | 'security' | 'support'>('main');

  const addLog = (type: ReviewLogEntry['type'], message: string, details?: ReviewLogEntry['details']) => {
    setReviewLogs(prev => [...prev, { timestamp: Date.now(), type, message, details }]);
  };

  const handlePauseReview = () => {
    pauseRef.current = true;
    setIsPaused(true);
    addLog('warning', 'Review paused by user');
  };

  const handleResumeReview = () => {
    pauseRef.current = false;
    setIsPaused(false);
    addLog('info', 'Review resumed');
  };

  const handleCancelReview = () => {
    cancelRef.current = true;
    setIsCancelled(true);
    setIsPaused(false);
    addLog('error', 'Review cancelled by user');
  };

  useEffect(() => {
    const config = initTheme();
    setTheme(config.theme);
  }, []);

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        const data = await calculateAnalytics();
        setAnalytics(data);
      } catch (err) {
        console.warn('Failed to load analytics:', err);
      }
    };
    loadAnalytics();
  }, [results]); // Reload analytics when results change

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleToggleTheme = useCallback(() => {
    const config = toggleTheme();
    setTheme(config.theme);
  }, []);

  const handleExport = useCallback((format: 'markdown' | 'html' | 'json') => {
    if (!results) return;
    
    const options: ExportOptions = {
      format,
      include_approved_only: false,
      include_rejected_only: false,
      include_metadata: true,
      include_statistics: true,
      template: 'detailed',
    };
    
    const result = exportReview(results, options, { prUrl: githubUrl });
    downloadExport(result);
    setShowExportModal(false);
    setSuccess(`Exported ${results.length} issues to ${format.toUpperCase()}`);
  }, [results, githubUrl]);

  const handleApproveAll = useCallback(() => {
    if (!results) return;
    setResults(results.map(issue => ({
      ...issue,
      approval_status: issue.approval_status === ApprovalStatus.PENDING ? ApprovalStatus.APPROVED : issue.approval_status
    })));
  }, [results]);

  const handleRejectAll = useCallback(() => {
    if (!results) return;
    setResults(results.map(issue => ({
      ...issue,
      approval_status: issue.approval_status === ApprovalStatus.PENDING ? ApprovalStatus.REJECTED : issue.approval_status
    })));
  }, [results]);

  const handleNextIssue = useCallback(() => {
    if (!results) return;
    setCurrentIssueIndex(prev => Math.min(prev + 1, results.length - 1));
  }, [results]);

  const handlePrevIssue = useCallback(() => {
    setCurrentIssueIndex(prev => Math.max(prev - 1, 0));
  }, []);

  useEffect(() => {
    initKeyboardShortcuts();
    registerDefaultShortcuts({
      toggleTheme: handleToggleTheme,
      approveAll: handleApproveAll,
      rejectAll: handleRejectAll,
      nextIssue: handleNextIssue,
      prevIssue: handlePrevIssue,
      showHelp: () => setShowShortcuts(true),
      closeModal: () => {
        setShowShortcuts(false);
        setShowExportModal(false);
      },
      exportReview: () => setShowExportModal(true),
    });
    
    return () => destroyKeyboardShortcuts();
  }, [handleToggleTheme, handleApproveAll, handleRejectAll, handleNextIssue, handlePrevIssue]);

  const handleAnalyze = async () => {
    if (!githubUrl.trim() || !githubToken.trim()) {
      setError('Please provide both GitHub PR URL and Personal Access Token.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    setResults(null);
    setReviewLogs([]);
    setCurrentReviewFile(undefined);
    setChunkProgress(undefined);
    setIsPaused(false);
    setIsCancelled(false);
    pauseRef.current = false;
    cancelRef.current = false;

    try {
      addLog('info', 'Starting PR analysis...');
      
      const prInfo = parseGitHubUrl(githubUrl);
      if (!prInfo) {
        setError('Invalid GitHub PR URL format.');
        addLog('error', 'Invalid GitHub PR URL format');
        return;
      }

      addLog('info', `Fetching PR diff from ${prInfo.owner}/${prInfo.repo}#${prInfo.pullNumber}`);
      const diff = await fetchPrDiff(githubUrl, githubToken, (progressMsg) => {
        addLog('info', progressMsg);
      });
      const fileCount = (diff.match(/^diff --git/gm) || []).length;
      const lineCount = diff.split('\n').length;
      addLog('success', `Fetched diff: ${fileCount} files, ${lineCount} lines`);

      let githubContext: GitHubMCPContext | undefined = undefined;
      let enhancedPRInfo: any = null;
      let prTitle = '';
      let prDescription = '';

      addLog('info', 'Fetching PR metadata...');
      if (useGitHubContext && prInfo) {
        try {
          enhancedPRInfo = await fetchPRInfoFromUrl(githubUrl, githubToken);
          prTitle = enhancedPRInfo.title;
          prDescription = enhancedPRInfo.description;
          githubContext = {
            owner: prInfo.owner,
            repo: prInfo.repo,
            token: githubToken,
            pullNumber: enhancedPRInfo.pullNumber,
            baseBranch: enhancedPRInfo.baseBranch,
            sourceBranch: enhancedPRInfo.sourceBranch,
          };
          addLog('success', `PR: "${prTitle.substring(0, 50)}${prTitle.length > 50 ? '...' : ''}"`);
        } catch (error) {
          addLog('warning', 'Could not fetch enhanced PR info, using basic context');
          githubContext = {
            owner: prInfo.owner,
            repo: prInfo.repo,
            token: githubToken,
          };
        }
      } else {
        try {
          enhancedPRInfo = await fetchPRInfoFromUrl(githubUrl, githubToken);
          prTitle = enhancedPRInfo.title;
          prDescription = enhancedPRInfo.description;
        } catch (error) {
          addLog('warning', 'Could not fetch basic PR info');
        }
      }

      const jiraContext: JiraConfluenceContext | undefined = useJiraConfluenceContext && jiraBaseUrl && jiraEmail && jiraToken
        ? {
            jiraBaseUrl,
            jiraEmail,
            jiraToken,
            confluenceBaseUrl: confluenceBaseUrl || undefined,
            confluenceToken: jiraToken,
          }
        : undefined;

      if (jiraContext) {
        addLog('info', `Jira integration enabled - searching for ticket keys in PR...`);
        addLog('info', `Jira URL: ${jiraContext.jiraBaseUrl}`);
        if (jiraContext.confluenceBaseUrl) {
          addLog('info', `Confluence URL: ${jiraContext.confluenceBaseUrl}`);
        }
      } else if (useJiraConfluenceContext) {
        addLog('warning', `Jira enabled but missing config: URL=${!!jiraBaseUrl}, Email=${!!jiraEmail}, Token=${!!jiraToken}`);
      }

      addLog('info', 'Checking for merge conflicts...');
      const conflictCheck = await checkMergeConflicts(githubUrl, githubToken);
      if (conflictCheck.hasConflicts) {
        addLog('warning', `Merge conflicts detected: ${conflictCheck.conflictDetails}`);
      } else {
        addLog('success', 'No merge conflicts');
      }

      addLog('progress', 'Starting AI analysis...');
      const data = await analyzeDiff(diff, githubContext, jiraContext, prTitle, prDescription, {
        onProgress: (chunkInfo) => {
          if (chunkInfo.status === 'analyzing') {
            setCurrentReviewFile(chunkInfo.currentFiles[0]);
            setChunkProgress({
              current: chunkInfo.currentChunk,
              total: chunkInfo.totalChunks,
              percentage: Math.round((chunkInfo.currentChunk / chunkInfo.totalChunks) * 100)
            });
            addLog('progress', `Analyzing chunk ${chunkInfo.currentChunk}/${chunkInfo.totalChunks}`, {
              chunk: chunkInfo.currentChunk,
              totalChunks: chunkInfo.totalChunks,
              file: chunkInfo.currentFiles[0]
            });
          } else if (chunkInfo.status === 'complete') {
            addLog('success', 'AI analysis complete');
            setCurrentReviewFile(undefined);
          }
        },
        shouldPause: () => pauseRef.current,
        shouldCancel: () => cancelRef.current,
      });

      if (cancelRef.current) {
        addLog('warning', 'Review was cancelled');
        return;
      }
      
      addLog('success', `Analysis complete: ${data.issues.length} issues found`);
      
      // Add conflict information as a special issue if conflicts exist
      let allIssues = [...data.issues];
      if (conflictCheck.hasConflicts) {
        const conflictIssue: PRIssue = {
          bug_type: BugType.MERGE_CONFLICT,
          bug_description: `⚠️ Please resolve merge conflicts before proceeding. ${conflictCheck.conflictDetails}`,
          severity: Severity.HIGH,
          line_numbers: '1',
          file_name: 'PR_ROOT',
          snippet: 'This PR has merge conflicts that need to be resolved.',
          suggested_fix: 'Pull the latest changes from the base branch and resolve conflicts locally, then push the resolved changes.',
          suggested_code: `# Steps to resolve:\ngit fetch origin\ngit checkout your-branch\ngit merge origin/main\n# Resolve conflicts in your editor\ngit add .\ngit commit -m "Resolve merge conflicts"\ngit push`,
        };
        allIssues.unshift(conflictIssue); // Add at the beginning to highlight conflicts
      }
      
      // Initialize all issues with unique ID and pending status
      const issuesWithStatus = allIssues.map((issue, idx) => ({
        ...issue,
        id: `issue-${Date.now()}-${idx}`,
        approval_status: ApprovalStatus.PENDING,
        rejection_reason: ''
      }));
      
      setResults(issuesWithStatus);

      
    } catch (err: any) {
      setError(err.message || 'Failed to analyze PR. Please check your token permissions.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePostReview = async () => {
    if (!results || !githubUrl || !githubToken) return;

    const approvedIssues = results.filter(issue => issue.approval_status === ApprovalStatus.APPROVED);
    
    if (approvedIssues.length === 0) {
      setError('No approved comments to submit. Please approve at least one issue.');
      return;
    }

    setPosting(true);
    setError(null);
    try {
      const result = await submitPrReview(githubUrl, githubToken, approvedIssues, 'NhoNH');
      
      if (result.skipped > 0 && result.posted === 0) {
        setSuccess(`Review summary posted. ${result.skipped} inline comments skipped (files/lines not in diff).`);
      } else if (result.skipped > 0) {
        setSuccess(`Posted ${result.posted} comments. ${result.skipped} skipped (files/lines not in diff).`);
      } else {
        setSuccess(`Successfully posted ${result.posted} review comments to GitHub!`);
      }
      
      setResults(results.map(issue => ({
        ...issue,
        approval_status: ApprovalStatus.REJECTED
      })));
    } catch (err: any) {
      setError(`Failed to post review: ${err.message}`);
    } finally {
      setPosting(false);
    }
  };

  const handleApprove = (issueId: string) => {
    if (!results) return;
    setResults(results.map(issue => 
      issue.id === issueId 
        ? { ...issue, approval_status: ApprovalStatus.APPROVED, rejection_reason: '' }
        : issue
    ));
  };

  const handleReject = (issueId: string, reason?: string) => {
    if (!results) return;
    setResults(results.map(issue => 
      issue.id === issueId 
        ? { ...issue, approval_status: ApprovalStatus.REJECTED, rejection_reason: reason || 'Rejected by reviewer' }
        : issue
    ));
  };

  const handleReset = (issueId: string) => {
    if (!results) return;
    setResults(results.map(issue => 
      issue.id === issueId 
        ? { ...issue, approval_status: ApprovalStatus.PENDING, rejection_reason: '' }
        : issue
    ));
  };

  const getSeverityColor = (severity: Severity) => {
    switch (severity) {
      case Severity.HIGH: return 'text-red-600 bg-red-50 border-red-200';
      case Severity.MEDIUM: return 'text-orange-600 bg-orange-50 border-orange-200';
      case Severity.LOW: return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  const getStatusIcon = (status?: ApprovalStatus) => {
    switch (status) {
      case ApprovalStatus.APPROVED:
        return <Check className="w-5 h-5 text-emerald-600" />;
      case ApprovalStatus.REJECTED:
        return <X className="w-5 h-5 text-red-400" />;
      default:
        return <Eye className="w-5 h-5 text-amber-500" />;
    }
  };

  const getStatusColor = (status?: ApprovalStatus) => {
    switch (status) {
      case ApprovalStatus.APPROVED:
        return 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/30 dark:bg-emerald-900/20';
      case ApprovalStatus.REJECTED:
        return 'border-red-200 dark:border-red-800 bg-red-50/10 dark:bg-red-900/10 opacity-60';
      default:
        return 'border-slate-200 dark:border-slate-700';
    }
  };

  const filteredResults = results?.filter(issue => {
    if (filter === 'all') return true;
    return issue.approval_status === filter;
  }) || [];

  const stats = {
    total: results?.length || 0,
    pending: results?.filter(i => i.approval_status === ApprovalStatus.PENDING).length || 0,
    approved: results?.filter(i => i.approval_status === ApprovalStatus.APPROVED).length || 0,
    rejected: results?.filter(i => i.approval_status === ApprovalStatus.REJECTED).length || 0,
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  const requiresAuthentication = import.meta.env.MODE === 'production';
  
  if (requiresAuthentication && !user) {
    return <LoginScreen />;
  }

  if (currentPage === 'docs') {
    return <DocumentationPage onBack={() => setCurrentPage('main')} />;
  }

  if (currentPage === 'security') {
    return <SecurityPage onBack={() => setCurrentPage('main')} />;
  }

  if (currentPage === 'support') {
    return <SupportPage onBack={() => setCurrentPage('main')} />;
  }

  return (
    <div className="min-h-screen flex flex-col font-sans bg-slate-50/50 dark:bg-slate-900">
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-50 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 p-2.5 rounded-xl shadow-indigo-500/20 shadow-lg">
              <Code2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight flex items-center">
                Gear PR Review
                <span className="ml-2 text-[10px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/30 uppercase tracking-tighter">Pro</span>
              </h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">by NhoNH</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
             <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 rounded-full border border-indigo-500/30">
               <div className="flex -space-x-1">
                 <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                 <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" style={{ animationDelay: '0.2s' }} />
                 <div className="w-2 h-2 rounded-full bg-pink-400 animate-pulse" style={{ animationDelay: '0.4s' }} />
               </div>
               <span className="text-[10px] font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 uppercase tracking-wider">Multi-AI Engine</span>
             </div>
             <button
               onClick={handleToggleTheme}
               className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:bg-slate-700/50 transition-colors"
               title={`Theme: ${theme}`}
             >
               {theme === 'dark' ? <Moon className="w-4 h-4 text-indigo-400" /> : 
                theme === 'light' ? <Sun className="w-4 h-4 text-yellow-400" /> : 
                <Monitor className="w-4 h-4 text-slate-400" />}
             </button>
             <button
               onClick={() => setShowShortcuts(true)}
               className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:bg-slate-700/50 transition-colors"
               title="Keyboard shortcuts (⌘/)"
             >
               <Keyboard className="w-4 h-4 text-slate-400" />
             </button>
            {user ? (
              <div className="flex items-center space-x-2">
                <img
                  src={user.picture}
                  alt={user.name}
                  className="w-8 h-8 rounded-full border-2 border-indigo-500/50"
                />
                <div className="hidden sm:block">
                  <p className="text-xs font-medium text-slate-200 leading-none">{user.name}</p>
                  <p className="text-[10px] text-slate-400 leading-none mt-0.5">{user.email}</p>
                </div>
                <button
                  onClick={signOut}
                  className="p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                Bot: NhoNH
              </span>
            )}
          </div>
        </div>
      </header>

      {showShortcuts && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowShortcuts(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center">
                <Keyboard className="w-5 h-5 mr-2 text-indigo-500" />
                Keyboard Shortcuts
              </h3>
              <button onClick={() => setShowShortcuts(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-300">Toggle theme</span><kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs">⌘⇧D</kbd></div>
                <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-300">Export</span><kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs">⌘E</kbd></div>
                <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-300">Approve all</span><kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs">⌘⇧A</kbd></div>
                <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-300">Reject all</span><kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs">⌘⇧R</kbd></div>
                <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-300">Next issue</span><kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs">J</kbd></div>
                <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-300">Previous issue</span><kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs">K</kbd></div>
                <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-300">Show shortcuts</span><kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs">⌘/</kbd></div>
                <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-300">Close modal</span><kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs">Esc</kbd></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowExportModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center">
                <Download className="w-5 h-5 mr-2 text-indigo-500" />
                Export Review
              </h3>
              <button onClick={() => setShowExportModal(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => handleExport('markdown')}
                className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <span className="font-medium text-slate-700 dark:text-slate-200">Markdown (.md)</span>
                <span className="text-xs text-slate-500">Best for GitHub/GitLab</span>
              </button>
              <button
                onClick={() => handleExport('html')}
                className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <span className="font-medium text-slate-700 dark:text-slate-200">HTML (.html)</span>
                <span className="text-xs text-slate-500">Printable report</span>
              </button>
              <button
                onClick={() => handleExport('json')}
                className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <span className="font-medium text-slate-700 dark:text-slate-200">JSON (.json)</span>
                <span className="text-xs text-slate-500">For integrations</span>
              </button>
            </div>
          </div>
        </div>
      )}

       <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {user && !user.hasGeminiAccess && (
          <section className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <div>
                <p className="text-sm font-medium text-amber-400">Limited Access</p>
                <p className="text-xs text-slate-400">Sign out and sign in again to grant Gemini API access.</p>
              </div>
            </div>
          </section>
        )}

<section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Github className="w-5 h-5 text-slate-900 dark:text-slate-100" />
              <h2 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight">GitHub Integration</h2>
            </div>
            <div className="flex items-center space-x-1 text-xs text-slate-400 dark:text-slate-500">
               <Info className="w-3.5 h-3.5" />
               <span>Fetch PR changes automatically</span>
            </div>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Pull Request URL</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Link className="h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                </div>
                <input
                  type="text"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/owner/repo/pull/123"
                  className="block w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 text-sm font-medium rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Personal Access Token</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Key className="h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                </div>
                <input
                  type="password"
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxx"
                  className="block w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 text-sm font-medium rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>
            </div>
          </div>
           <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/30">
             <div className="flex items-center space-x-4">
               <div className="space-y-2 flex-1 max-w-xs relative z-30">
                 <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Review Preset</label>
                 <div className="relative">
                    <button
                      onClick={() => setShowPresetDropdown(!showPresetDropdown)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 text-sm font-medium rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                    >
                      <span>{selectedPreset?.name || 'Select Preset'}</span>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showPresetDropdown ? 'rotate-180' : ''}`} />
                    </button>
                   {showPresetDropdown && (
                     <div className="absolute z-50 mt-2 w-full bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                       <div className="max-h-72 overflow-y-auto">
                         {BUILTIN_PRESETS.map((preset, index) => (
                           <button
                             key={preset.id}
                             onClick={() => {
                               setSelectedPreset(preset);
                               setEnableJS2026(preset.js2026_enabled);
                               setEnablePerformanceAnalysis(preset.performance_analysis);
                               setShowPresetDropdown(false);
                             }}
                             className={`w-full px-4 py-3.5 text-left transition-all duration-150 ${
                               selectedPreset?.id === preset.id 
                                 ? 'bg-indigo-50 dark:bg-indigo-500/20 border-l-2 border-l-indigo-500' 
                                 : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700'
                             } ${index === BUILTIN_PRESETS.length - 1 ? 'border-0' : ''}`}
                           >
                             <div className="flex items-center justify-between mb-1">
                               <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{preset.name}</span>
                               {selectedPreset?.id === preset.id && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 animate-in zoom-in duration-200" />}
                             </div>
                             <p className="text-xs text-slate-500 dark:text-slate-400">{preset.description}</p>
<div className="flex flex-wrap items-center gap-1.5 mt-2 text-[10px]">
                                {preset.type === 'STRICT' && (
                                  <span className="px-2 py-1 rounded-full font-semibold bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300">
                                    All Rules
                                  </span>
                                )}
                                {preset.type === 'SECURITY_FOCUSED' && (
                                  <span className="px-2 py-1 rounded-full font-semibold bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300">
                                    Security
                                  </span>
                                )}
                                {preset.type === 'PERFORMANCE_FOCUSED' && (
                                  <span className="px-2 py-1 rounded-full font-semibold bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300">
                                    Speed
                                  </span>
                                )}
                                {preset.type === 'LENIENT' && (
                                  <span className="px-2 py-1 rounded-full font-semibold bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300">
                                    Fast
                                  </span>
                                )}
                                {preset.type === 'MODERATE' && (
                                  <span className="px-2 py-1 rounded-full font-semibold bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300">
                                    Balanced
                                  </span>
                                )}
                                <span className={`px-2 py-1 rounded-full font-semibold ${
                                  preset.severity_threshold === 'LOW' 
                                    ? 'bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
                                    : preset.severity_threshold === 'MEDIUM'
                                    ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'
                                    : 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300'
                                }`}>
                                  {preset.severity_threshold === 'LOW' ? 'All Severity' : preset.severity_threshold === 'MEDIUM' ? 'Med+' : 'High Only'}
                                </span>
                                {preset.js2026_enabled && (
                                  <span className="px-2 py-1 rounded-full font-semibold bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300">
                                    ES2024+
                                  </span>
                                )}
                              </div>
                           </button>
                         ))}
                       </div>
                     </div>
                   )}
                 </div>
               </div>
                {selectedPreset && (
                  <div className="flex-1 bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2 mb-3">
                      <Wand2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">Preset Active</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors
                        ${selectedPreset.js2026_enabled 
                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${selectedPreset.js2026_enabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        JS 2026
                      </div>
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors
                        ${selectedPreset.performance_analysis 
                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${selectedPreset.performance_analysis ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        Performance
                      </div>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30">
                        <span className="text-slate-600 dark:text-slate-400">Severity:</span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">{selectedPreset.severity_threshold}</span>
                      </div>
                    </div>
                  </div>
                )}
             </div>
           </div>
          <div className="px-6 py-4 bg-slate-50/80 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4">
             <div className="flex items-center space-x-6">
               <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                 Requires <code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded text-slate-600 dark:text-slate-300">repo</code> scope for private repos or <code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded text-slate-600 dark:text-slate-300">public_repo</code> for public ones.
               </p>
               <label className="flex items-center space-x-2 cursor-pointer">
                 <input
                   type="checkbox"
                   checked={useGitHubContext}
                   onChange={(e) => setUseGitHubContext(e.target.checked)}
                   className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-slate-300 dark:border-slate-600"
                 />
                 <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Deep Context</span>
               </label>
               <label className="flex items-center space-x-2 cursor-pointer">
                 <input
                   type="checkbox"
                   checked={enableJS2026}
                   onChange={(e) => setEnableJS2026(e.target.checked)}
                   className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-slate-300 dark:border-slate-600"
                 />
                 <span className="text-xs font-bold text-slate-700 dark:text-slate-200">JS 2026 Syntax</span>
               </label>
               <label className="flex items-center space-x-2 cursor-pointer">
                 <input
                   type="checkbox"
                   checked={enablePerformanceAnalysis}
                   onChange={(e) => setEnablePerformanceAnalysis(e.target.checked)}
                   className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-slate-300 dark:border-slate-600"
                 />
                 <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Performance Analysis</span>
               </label>
             </div>
              <button
               onClick={handleAnalyze}
               disabled={loading || !githubUrl || !githubToken}
               className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black rounded-xl shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all"
             >
               {loading ? (
                 <>
                   <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                   {progress ? `${progress.current_task} (${progress.percentage}%)` : 'Analyzing...'}
                 </>
               ) : (
                 <>
                   <Sparkles className="w-4 h-4 mr-2" />
                   Review GitHub PR
                 </>
               )}
             </button>
          </div>
          {(loading || reviewLogs.length > 0) && (
            <div className="px-6 pb-4">
              <ReviewTerminal
                logs={reviewLogs}
                isActive={loading}
                isPaused={isPaused}
                currentFile={currentReviewFile}
                progress={chunkProgress}
                onPause={handlePauseReview}
                onResume={handleResumeReview}
                onCancel={handleCancelReview}
              />
            </div>
          )}
        </section>

        <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Wand2 className="w-5 h-5 text-slate-900 dark:text-slate-100" />
              <h2 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight">Jira/Confluence Integration</h2>
            </div>
            <div className="flex items-center space-x-1 text-xs text-slate-400 dark:text-slate-500">
               <Info className="w-3.5 h-3.5" />
               <span>Enhance reviews with PRD and ticket context</span>
            </div>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useJiraConfluenceContext}
                  onChange={(e) => setUseJiraConfluenceContext(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-slate-300 dark:border-slate-600"
                />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Enable Jira/Confluence Context Analysis</span>
              </label>
            </div>
            
            {useJiraConfluenceContext && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Jira Base URL</label>
                    <input
                      type="text"
                      value={jiraBaseUrl}
                      onChange={(e) => setJiraBaseUrl(e.target.value)}
                      placeholder="https://your-domain.atlassian.net (without trailing /)"
                      className="block w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 text-sm font-medium rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Jira Email</label>
                    <input
                      type="email"
                      value={jiraEmail}
                      onChange={(e) => setJiraEmail(e.target.value)}
                      placeholder="your-email@company.com"
                      className="block w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 text-sm font-medium rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Atlassian API Token</label>
                    <input
                      type="password"
                      value={jiraToken}
                      onChange={(e) => setJiraToken(e.target.value)}
                      placeholder="ATATT3xFfGF0..."
                      className="block w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 text-sm font-medium rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                    <p className="text-xs text-slate-400 dark:text-slate-500 pl-1">
                      Used for both Jira and Confluence API calls
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">
                    Confluence Page URLs (Optional) 
                    <span className="font-normal normal-case ml-1">— one URL per line</span>
                  </label>
                  <textarea
                    value={confluenceBaseUrl}
                    onChange={(e) => setConfluenceBaseUrl(e.target.value)}
                    placeholder={"https://your-domain.atlassian.net/wiki/spaces/TEAM/pages/123456/PRD+Document\nhttps://your-domain.atlassian.net/wiki/spaces/TEAM/pages/789012/Technical+Spec"}
                    rows={3}
                    className="block w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 text-sm font-medium rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-y"
                  />
                  <p className="text-xs text-slate-400 dark:text-slate-500 pl-1">
                    Paste direct page URLs. Supports multiple pages — each will be fetched and used as AI context.
                  </p>
                </div>
                
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start space-x-3">
                    <Info className="w-4 h-4 text-blue-500 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-blue-700 dark:text-blue-300">
                      <p className="font-black mb-1">How this works:</p>
                      <ul className="space-y-1 list-disc list-inside">
                        <li>Auto-detects Jira ticket keys from PR title/description (e.g., PROJ-123)</li>
                        <li>Fetches ticket details, status, and related tickets</li>
                        <li>Fetches content directly from Confluence page URLs you provide</li>
                        <li>Enhances AI analysis with project context and requirements</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <button 
            onClick={() => setShowAnalytics(!showAnalytics)}
            className="w-full px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between hover:bg-slate-100/50 dark:hover:bg-slate-700/50 transition-colors"
          >
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-slate-900 dark:text-slate-100" />
              <h2 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight">Review Analytics</h2>
            </div>
            <div className="flex items-center space-x-3">
              {analytics && analytics.total_reviews > 0 && (
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{analytics.total_reviews} reviews</span>
              )}
              {showAnalytics ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </div>
          </button>
          
          {showAnalytics && (
            <div className="animate-in fade-in duration-300">
              <div className="flex border-b border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setShowHistoryTab('summary')}
                  className={`px-6 py-3 text-sm font-semibold transition-colors ${
                    showHistoryTab === 'summary'
                      ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  Summary
                </button>
                <button
                  onClick={() => setShowHistoryTab('history')}
                  className={`px-6 py-3 text-sm font-semibold transition-colors ${
                    showHistoryTab === 'history'
                      ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  History
                </button>
              </div>

              <div className="p-6 space-y-6">
                {showHistoryTab === 'summary' ? (
                  <>
                    {!analytics || analytics.total_reviews === 0 ? (
                      <div className="text-center py-8">
                        <Activity className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                        <p className="text-slate-500 dark:text-slate-400 font-medium">No review history yet</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Analytics will appear after you complete your first review</p>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-900/20 dark:to-indigo-800/10 rounded-xl p-4 border border-indigo-100 dark:border-indigo-800">
                            <div className="flex items-center space-x-2 mb-2">
                              <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                              <span className="text-[10px] font-black text-indigo-700 dark:text-indigo-300 uppercase tracking-widest">Total Reviews</span>
                            </div>
                            <p className="text-2xl font-black text-indigo-900 dark:text-indigo-100">{analytics.total_reviews}</p>
                          </div>
                          <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-800/10 rounded-xl p-4 border border-amber-100 dark:border-amber-800">
                            <div className="flex items-center space-x-2 mb-2">
                              <Bug className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                              <span className="text-[10px] font-black text-amber-700 dark:text-amber-300 uppercase tracking-widest">Avg Issues/PR</span>
                            </div>
                            <p className="text-2xl font-black text-amber-900 dark:text-amber-100">{analytics.average_issues_per_pr.toFixed(1)}</p>
                          </div>
                          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-900/20 dark:to-emerald-800/10 rounded-xl p-4 border border-emerald-100 dark:border-emerald-800">
                            <div className="flex items-center space-x-2 mb-2">
                              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                              <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-widest">Issue Types</span>
                            </div>
                            <p className="text-2xl font-black text-emerald-900 dark:text-emerald-100">{analytics.most_common_issues.length}</p>
                          </div>
                          <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/10 rounded-xl p-4 border border-purple-100 dark:border-purple-800">
                            <div className="flex items-center space-x-2 mb-2">
                              <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                              <span className="text-[10px] font-black text-purple-700 dark:text-purple-300 uppercase tracking-widest">Avg Duration</span>
                            </div>
                            <p className="text-2xl font-black text-purple-900 dark:text-purple-100">
                              {analytics.performance_trend.length > 0 
                                ? `${(analytics.performance_trend.reduce((a, b) => a + b.average_duration, 0) / analytics.performance_trend.length / 1000).toFixed(1)}s`
                                : '-'}
                            </p>
                          </div>
                        </div>

                        {analytics.most_common_issues.length > 0 && (
                          <div className="space-y-3">
                            <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Most Common Issues</h3>
                            <div className="space-y-2">
                              {analytics.most_common_issues.slice(0, 5).map((issue, idx) => {
                                const maxCount = analytics.most_common_issues[0]?.count || 1;
                                const percentage = (issue.count / maxCount) * 100;
                                return (
                                  <div key={idx} className="flex items-center space-x-3">
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 w-32 truncate">{(issue.type || 'UNKNOWN').replace(/_/g, ' ')}</span>
                                    <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                                      <div 
                                        className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-2 rounded-full transition-all duration-500"
                                        style={{ width: `${percentage}%` }}
                                      />
                                    </div>
                                    <span className="text-xs font-black text-slate-800 dark:text-slate-200 w-8 text-right">{issue.count}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {analytics.trend_data.length > 1 && (
                          <div className="space-y-3">
                            <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Issues Trend (Last 7 Days)</h3>
                            <div className="flex items-end space-x-1 h-20">
                              {analytics.trend_data.slice(-7).map((day, idx) => {
                                const maxIssues = Math.max(...analytics.trend_data.slice(-7).map(d => d.issues_count)) || 1;
                                const height = (day.issues_count / maxIssues) * 100;
                                return (
                                  <div key={idx} className="flex-1 flex flex-col items-center">
                                    <div 
                                      className="w-full bg-gradient-to-t from-indigo-500 to-indigo-400 rounded-t-sm transition-all duration-300 hover:from-indigo-600 hover:to-indigo-500"
                                      style={{ height: `${Math.max(height, 4)}%` }}
                                      title={`${day.date}: ${day.issues_count} issues`}
                                    />
                                    <span className="text-[8px] text-slate-400 mt-1">{new Date(day.date).toLocaleDateString('en', { weekday: 'short' })}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <ReviewHistoryList
                    onSelectReview={(review) => setSelectedHistoryReview(review)}
                    onRefresh={async () => {
                      const data = await calculateAnalytics();
                      setAnalytics(data);
                    }}
                  />
                )}
              </div>
            </div>
          )}

          {selectedHistoryReview && (
            <ReviewHistoryDetail
              review={selectedHistoryReview}
              onClose={() => setSelectedHistoryReview(null)}
              onReanalyze={(prUrl) => {
                setGithubUrl(prUrl);
                setSelectedHistoryReview(null);
                setShowAnalytics(false);
              }}
            />
          )}
        </section>

        {error && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start space-x-3 text-red-700 dark:text-red-300 animate-in fade-in slide-in-from-top-4 duration-300">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-bold">{error}</p>
          </div>
        )}

        {success && (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 flex items-start space-x-3 text-emerald-700 dark:text-emerald-300 animate-in fade-in slide-in-from-top-4 duration-300">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-bold">{success}</p>
          </div>
        )}

        {results !== null && (
          <section className="space-y-8 animate-in fade-in duration-500 pb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-6 gap-4">
              <div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white flex items-center tracking-tight">
                  <ShieldAlert className="w-8 h-8 mr-3 text-indigo-600 dark:text-indigo-400" />
                  Analysis Summary
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">Review and approve comments before submitting to GitHub.</p>
              </div>
              
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowExportModal(true)}
                  className="inline-flex items-center justify-center px-4 py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-bold rounded-xl transition-all"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </button>
                <button
                  onClick={handleApproveAll}
                  disabled={stats.pending === 0}
                  className="inline-flex items-center justify-center px-4 py-3 bg-indigo-100 dark:bg-indigo-900/30 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-sm font-bold rounded-xl disabled:opacity-50 transition-all"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Approve All
                </button>
                <button
                  onClick={handlePostReview}
                  disabled={posting || stats.approved === 0}
                  className="flex-1 md:flex-none inline-flex items-center justify-center px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black rounded-xl shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:bg-slate-400 transition-all"
                >
                  {posting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  Submit {stats.approved} Approved Comment{stats.approved !== 1 ? 's' : ''}
                </button>
                {githubUrl && (
                  <a 
                    href={githubUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl transition-colors shadow-sm"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </a>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Filter:</span>
              </div>
              <div className="flex space-x-2">
                {(['pending', 'approved', 'rejected', 'all'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                      filter === f
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                    }`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                    {f !== 'all' && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] bg-white/20">
                        {stats[f as keyof typeof stats]}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
                <div className="flex items-center space-x-2 mb-2">
                  <Eye className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-black text-amber-700 dark:text-amber-300 uppercase tracking-widest">Pending Review</span>
                </div>
                <p className="text-3xl font-black text-amber-900 dark:text-amber-100">{stats.pending}</p>
                <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">Awaiting your decision</p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center space-x-2 mb-2">
                  <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-widest">Approved</span>
                </div>
                <p className="text-3xl font-black text-emerald-900 dark:text-emerald-100">{stats.approved}</p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">Will be submitted to GitHub</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
                <div className="flex items-center space-x-2 mb-2">
                  <X className="w-5 h-5 text-red-600 dark:text-red-400" />
                  <span className="text-xs font-black text-red-700 dark:text-red-300 uppercase tracking-widest">Rejected</span>
                </div>
                <p className="text-3xl font-black text-red-900 dark:text-red-100">{stats.rejected}</p>
                <p className="text-[10px] text-red-600 dark:text-red-400 mt-1">Will not be submitted</p>
              </div>
            </div>

            {filteredResults.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-16 text-center shadow-sm">
                <div className="bg-slate-50 dark:bg-slate-700 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Filter className="w-10 h-10 text-slate-400 dark:text-slate-500" />
                </div>
                <h4 className="text-2xl font-bold text-slate-900 dark:text-white">No {filter} comments</h4>
                <p className="text-slate-500 dark:text-slate-400 mt-3 max-w-lg mx-auto font-medium">
                  {filter === 'all' 
                    ? 'No issues were found in this PR.'
                    : `No ${filter} issues to display.`}
                </p>
              </div>
            ) : (
              <div className="grid gap-8">
                {filteredResults.map((issue, idx) => (
                  <div 
                    key={idx} 
                    className={`bg-white dark:bg-slate-800 rounded-3xl shadow-sm border-2 overflow-hidden flex flex-col group hover:shadow-md transition-all ${getStatusColor(issue.approval_status)}`}
                  >
                    <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/30 flex flex-wrap gap-4 items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-1 bg-white dark:bg-slate-700 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm">
                          {getStatusIcon(issue.approval_status)}
                          <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                            {issue.approval_status?.toUpperCase() || 'PENDING'}
                          </span>
                        </div>
                        <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border ${getSeverityColor(issue.severity)}`}>
                          {issue.severity}
                        </span>
                        <span className="px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-slate-900 text-white border border-slate-800">
                          {(issue.bug_type || 'UNKNOWN').replace(/_/g, ' ')}
                        </span>
                        {issue.prd_related && (
                          issue.prd_requirement ? (
                            <RequirementTooltip requirement={issue.prd_requirement}>
                              <span className="px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-purple-600 text-white border border-purple-500 cursor-help hover:bg-purple-700 transition-colors">
                                PRD/TDD
                              </span>
                            </RequirementTooltip>
                          ) : (
                            <span className="px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-purple-600 text-white border border-purple-500">
                              PRD/TDD
                            </span>
                          )
                        )}
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center text-slate-500 dark:text-slate-300 font-mono text-xs font-bold bg-white dark:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm">
                          <Terminal className="w-3.5 h-3.5 mr-2 text-indigo-500 dark:text-indigo-400" />
                          {issue.file_name} <span className="mx-2 text-slate-300 dark:text-slate-500">/</span> L{issue.line_numbers}
                        </div>
                      </div>
                    </div>

                    <div className="p-8 space-y-8">
                      <div className="space-y-3">
                        <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 flex items-center uppercase tracking-[0.2em]">
                          <Bug className="w-3.5 h-3.5 mr-2 text-red-500 dark:text-red-400" />
                          Issue Identification
                        </h4>
                        <p className="text-slate-800 dark:text-slate-200 text-base leading-relaxed font-semibold pl-1">
                          {renderTextWithCode(issue.bug_description)}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <div className="flex items-center pl-1">
                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Original Code</span>
                          </div>
                          <div className="bg-slate-950 rounded-2xl p-6 border border-slate-800 shadow-2xl overflow-hidden min-h-[160px]">
                            <pre className="text-xs font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                              <code>{issue.snippet}</code>
                            </pre>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between pl-1">
                            <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">AI Fix Proposal</span>
                            <div className="flex items-center text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1 rounded-lg text-[10px] font-black border border-emerald-100 dark:border-emerald-800">
                              <Sparkles className="w-3 h-3 mr-1" />
                              OPTIMIZED</div>
                          </div>
                          <div className="bg-emerald-950/5 dark:bg-emerald-900/10 rounded-2xl p-6 border border-emerald-100 dark:border-emerald-800 shadow-sm overflow-hidden min-h-[160px] relative">
                            <pre className="text-xs font-mono text-emerald-900 dark:text-emerald-200 overflow-x-auto whitespace-pre-wrap leading-relaxed relative z-10">
                              <code>{issue.suggested_code}</code>
                            </pre>
                          </div>
                        </div>
                      </div>

                      <div className="bg-indigo-50/40 dark:bg-indigo-900/20 rounded-2xl p-6 border border-indigo-100/50 dark:border-indigo-800/50 flex items-start space-x-4">
                        <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
                          <Wand2 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-widest mb-1.5 opacity-60">Improvement Summary</p>
                          <p className="text-sm text-indigo-900 dark:text-indigo-200 leading-relaxed font-bold">
                            {renderTextWithCode(issue.suggested_fix)}
                          </p>
                        </div>
                      </div>

                      {issue.approval_status === ApprovalStatus.REJECTED && issue.rejection_reason && (
                        <div className="bg-red-50/50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
                          <div className="flex items-center space-x-2 mb-2">
                            <X className="w-4 h-4 text-red-500 dark:text-red-400" />
                            <span className="text-xs font-black text-red-700 dark:text-red-300 uppercase tracking-widest">Rejection Reason</span>
                          </div>
                          <p className="text-sm text-red-700 dark:text-red-300 font-medium">{issue.rejection_reason}</p>
                        </div>
                      )}

                      <div className="flex items-center justify-center space-x-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                        <button
                          onClick={() => issue.id && handleApprove(issue.id)}
                          disabled={issue.approval_status === ApprovalStatus.APPROVED}
                          className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${
                            issue.approval_status === ApprovalStatus.APPROVED
                              ? 'bg-emerald-100 text-emerald-700 cursor-not-allowed'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20'
                          }`}
                        >
                          <Check className="w-5 h-5" />
                          <span>Approve</span>
                        </button>
                        <button
                          onClick={() => issue.id && handleReject(issue.id)}
                          disabled={issue.approval_status === ApprovalStatus.REJECTED}
                          className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${
                            issue.approval_status === ApprovalStatus.REJECTED
                              ? 'bg-red-100 text-red-700 cursor-not-allowed'
                              : 'bg-slate-200 hover:bg-red-500 text-slate-700 hover:text-white shadow-sm'
                          }`}
                        >
                          <X className="w-5 h-5" />
                          <span>Reject</span>
                        </button>
                        {(issue.approval_status === ApprovalStatus.APPROVED || issue.approval_status === ApprovalStatus.REJECTED) && (
                          <button
                            onClick={() => issue.id && handleReset(issue.id)}
                            className="flex items-center space-x-2 px-4 py-3 rounded-xl font-bold text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-all"
                          >
                            <Eye className="w-4 h-4" />
                            <span>Reset</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="bg-slate-900 border-t border-slate-800 py-16 mt-auto">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="space-y-4 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start space-x-3">
                <div className="bg-indigo-600 p-2 rounded-xl">
                  <Code2 className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-black text-white tracking-tight">Gear PR Review</span>
              </div>
              <p className="text-slate-500 text-sm font-medium max-w-xs leading-relaxed">
                Empowering developers with AI-driven insights for safer, faster, and higher-quality code reviews.
              </p>
            </div>
            
            <div className="flex flex-col items-center md:items-end space-y-6">
              <div className="flex space-x-8 text-slate-400 font-black text-[10px] uppercase tracking-widest">
                 <button onClick={() => setCurrentPage('docs')} className="hover:text-white transition-colors">Documentation</button>
                 <button onClick={() => setCurrentPage('security')} className="hover:text-white transition-colors">Security</button>
                 <button onClick={() => setCurrentPage('support')} className="hover:text-white transition-colors">Support</button>
              </div>
              <p className="text-[10px] text-slate-600 font-black tracking-[0.3em] uppercase">
                &copy; {new Date().getFullYear()} NhoNH &bull; All Rights Reserved
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
