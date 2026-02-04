
export interface GitHubPrInfo {
  owner: string;
  repo: string;
  pullNumber: string;
}

export const parseGitHubUrl = (url: string): GitHubPrInfo | null => {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) return null;
  return {
    owner: match[1],
    repo: match[2],
    pullNumber: match[3],
  };
};

interface PRFile {
  sha: string;
  filename: string;
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged';
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  previous_filename?: string;
}

interface FetchProgress {
  currentPage: number;
  totalFiles: number;
  fetchedFiles: number;
}

const GITHUB_API_BASE = 'https://api.github.com';
const FILES_PER_PAGE = 100;
const MAX_CONCURRENT_REQUESTS = 5;
const RATE_LIMIT_DELAY_MS = 100;

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchAllPRFiles(
  info: GitHubPrInfo,
  token: string,
  onProgress?: (progress: FetchProgress) => void
): Promise<PRFile[]> {
  const allFiles: PRFile[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${info.owner}/${info.repo}/pulls/${info.pullNumber}/files?per_page=${FILES_PER_PAGE}&page=${page}`,
      {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to fetch PR files (page ${page}): ${errorData.message || response.statusText}`);
    }

    const files: PRFile[] = await response.json();
    allFiles.push(...files);

    onProgress?.({
      currentPage: page,
      totalFiles: allFiles.length,
      fetchedFiles: allFiles.length,
    });

    hasMore = files.length === FILES_PER_PAGE;
    page++;

    if (hasMore) {
      await delay(RATE_LIMIT_DELAY_MS);
    }
  }

  return allFiles;
}

async function fetchFileContent(
  info: GitHubPrInfo,
  token: string,
  filePath: string,
  ref: string
): Promise<string | null> {
  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${info.owner}/${info.repo}/contents/${encodeURIComponent(filePath)}?ref=${ref}`,
      {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3.raw',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) return null;
      return null;
    }

    return response.text();
  } catch {
    return null;
  }
}

function generateUnifiedDiff(
  filename: string,
  oldContent: string | null,
  newContent: string | null,
  status: PRFile['status']
): string {
  const lines: string[] = [];
  
  if (status === 'added') {
    lines.push(`diff --git a/${filename} b/${filename}`);
    lines.push('new file mode 100644');
    lines.push(`--- /dev/null`);
    lines.push(`+++ b/${filename}`);
    if (newContent) {
      const newLines = newContent.split('\n');
      lines.push(`@@ -0,0 +1,${newLines.length} @@`);
      newLines.forEach(line => lines.push(`+${line}`));
    }
  } else if (status === 'removed') {
    lines.push(`diff --git a/${filename} b/${filename}`);
    lines.push('deleted file mode 100644');
    lines.push(`--- a/${filename}`);
    lines.push(`+++ /dev/null`);
    if (oldContent) {
      const oldLines = oldContent.split('\n');
      lines.push(`@@ -1,${oldLines.length} +0,0 @@`);
      oldLines.forEach(line => lines.push(`-${line}`));
    }
  } else {
    lines.push(`diff --git a/${filename} b/${filename}`);
    lines.push(`--- a/${filename}`);
    lines.push(`+++ b/${filename}`);
    
    if (oldContent && newContent) {
      const oldLines = oldContent.split('\n');
      const newLines = newContent.split('\n');
      lines.push(`@@ -1,${oldLines.length} +1,${newLines.length} @@`);
      
      const maxLines = Math.max(oldLines.length, newLines.length);
      for (let i = 0; i < maxLines; i++) {
        if (i < oldLines.length && i < newLines.length) {
          if (oldLines[i] !== newLines[i]) {
            lines.push(`-${oldLines[i]}`);
            lines.push(`+${newLines[i]}`);
          } else {
            lines.push(` ${oldLines[i]}`);
          }
        } else if (i < oldLines.length) {
          lines.push(`-${oldLines[i]}`);
        } else if (i < newLines.length) {
          lines.push(`+${newLines[i]}`);
        }
      }
    }
  }
  
  return lines.join('\n');
}

function constructDiffFromPatches(files: PRFile[]): string {
  const diffs: string[] = [];
  
  for (const file of files) {
    if (file.patch) {
      const diffHeader = [
        `diff --git a/${file.filename} b/${file.filename}`,
        file.status === 'added' ? 'new file mode 100644' : '',
        file.status === 'removed' ? 'deleted file mode 100644' : '',
        file.status === 'renamed' && file.previous_filename 
          ? `rename from ${file.previous_filename}\nrename to ${file.filename}` 
          : '',
        `--- ${file.status === 'added' ? '/dev/null' : `a/${file.previous_filename || file.filename}`}`,
        `+++ ${file.status === 'removed' ? '/dev/null' : `b/${file.filename}`}`,
      ].filter(Boolean).join('\n');
      
      diffs.push(`${diffHeader}\n${file.patch}`);
    } else {
      diffs.push(`diff --git a/${file.filename} b/${file.filename}\n--- a/${file.filename}\n+++ b/${file.filename}\n@@ -0,0 +0,0 @@ Binary file or no changes`);
    }
  }
  
  return diffs.join('\n\n');
}

export const fetchPrDiff = async (
  url: string, 
  token: string,
  onProgress?: (message: string) => void
): Promise<string> => {
  const info = parseGitHubUrl(url);
  if (!info) throw new Error("Invalid GitHub PR URL");

  onProgress?.('Fetching PR diff...');
  
  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${info.owner}/${info.repo}/pulls/${info.pullNumber}`,
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3.diff",
      },
    }
  );

  if (response.ok) {
    return response.text();
  }

  if (response.status === 406) {
    onProgress?.('PR exceeds 300 files limit. Using paginated files API...');
    
    const files = await fetchAllPRFiles(info, token, (progress) => {
      onProgress?.(`Fetching files: page ${progress.currentPage}, ${progress.totalFiles} files found...`);
    });
    
    onProgress?.(`Retrieved ${files.length} files. Constructing diff...`);
    
    const diff = constructDiffFromPatches(files);
    
    onProgress?.(`Diff constructed from ${files.length} files`);
    
    return diff;
  }

  const errorData = await response.json().catch(() => ({ message: response.statusText }));
  throw new Error(`Failed to fetch PR diff: ${errorData.message || response.statusText}`);
};

export const fetchPRInfoFromUrl = async (url: string, token: string) => {
  const info = parseGitHubUrl(url);
  if (!info) throw new Error("Invalid GitHub PR URL");

  const response = await fetch(
    `https://api.github.com/repos/${info.owner}/${info.repo}/pulls/${info.pullNumber}`,
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch PR info: ${response.statusText}`);
  }

  const data = await response.json();

  // Check for detailed merge status if mergeable is null
  let mergeStatus = data.mergeable;
  let mergeableState = data.mergeable_state;
  
  if (mergeStatus === null) {
    // Fetch detailed merge status
    const statusResponse = await fetch(
      `https://api.github.com/repos/${info.owner}/${info.repo}/pulls/${info.pullNumber}`,
      {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );
    
    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      mergeStatus = statusData.mergeable;
      mergeableState = statusData.mergeable_state;
    }
  }

  return {
    ...info,
    pullNumber: parseInt(info.pullNumber),
    title: data.title || '',
    description: data.body || '',
    baseBranch: data.base?.ref || 'main',
    sourceBranch: data.head?.ref || 'unknown',
    headSha: data.head?.sha || '',
    baseSha: data.base?.sha || '',
    state: data.state || 'open',
    mergeable: mergeStatus,
    mergeableState: mergeableState,
    merged: data.merged,
    additions: data.additions || 0,
    deletions: data.deletions || 0,
    changedFiles: data.changed_files || 0,
    author: data.user?.login || 'unknown',
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
};

export const checkMergeConflicts = async (url: string, token: string): Promise<{
  hasConflicts: boolean;
  conflictDetails?: string;
}> => {
  try {
    const prInfo = await fetchPRInfoFromUrl(url, token);
    
    if (prInfo.merged) {
      return { hasConflicts: false, conflictDetails: 'PR is already merged' };
    }

    if (prInfo.mergeable === false) {
      return { 
        hasConflicts: true, 
        conflictDetails: `Merge status: ${prInfo.mergeableState || 'unknown'} - PR cannot be merged automatically` 
      };
    }

    if (prInfo.mergeable === true) {
      return { hasConflicts: false, conflictDetails: 'PR can be merged cleanly' };
    }

    // If mergeable is null, check the detailed state
    if (prInfo.mergeableState === 'dirty') {
      return { 
        hasConflicts: true, 
        conflictDetails: 'Merge conflicts detected - PR requires manual resolution' 
      };
    }

    if (prInfo.mergeableState === 'unstable') {
      return { 
        hasConflicts: false, 
        conflictDetails: 'PR has failing commits but no merge conflicts' 
      };
    }

    if (prInfo.mergeableState === 'clean') {
      return { hasConflicts: false, conflictDetails: 'PR can be merged cleanly' };
    }

    return { hasConflicts: false, conflictDetails: `Merge status: ${prInfo.mergeableState || 'checking...'}` };
  } catch (error) {
    return { 
      hasConflicts: false, 
      conflictDetails: `Unable to check conflicts: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
};

// Human-readable severity labels (no emojis - Template C)
const SEVERITY_LABELS: Record<string, string> = {
  HIGH: 'High Severity',
  MEDIUM: 'Medium Severity',
  LOW: 'Low Severity',
  CRITICAL: 'Critical Severity',
};

// Human-friendly bug type labels
const BUG_TYPE_LABELS: Record<string, string> = {
  RACE_CONDITION: 'Race Condition',
  STATE_MANAGEMENT: 'State Management',
  MEMORY_LEAK: 'Memory Leak',
  SECURITY: 'Security',
  CRASH: 'Crash Risk',
  CORRUPTION: 'Data Corruption',
  PERFORMANCE: 'Performance',
  RESOURCE_LEAK: 'Resource Leak',
  MERGE_CONFLICT: 'Merge Conflict',
  CODE_DUPLICATION: 'Code Duplication',
  BREAKING_CHANGE: 'Breaking Change',
  DEPENDENCY_ISSUE: 'Dependency Issue',
  JS_SYNTAX_OPTIMIZATION: 'JS Syntax Optimization',
};

/**
 * Format individual comment body using Template C (Human Conversational)
 * No emojis, natural language, professional tone
 */
function formatCommentBody(issue: any): string {
  const severity = issue.severity || 'MEDIUM';
  const severityLabel = SEVERITY_LABELS[severity] || 'Medium Severity';
  const bugType = BUG_TYPE_LABELS[issue.bug_type] || issue.bug_type?.replace(/_/g, ' ') || 'Issue';
  
  // Make suggested_fix start with lowercase for natural flow after "Consider"
  const suggestedFix = issue.suggested_fix || '';
  const fixText = suggestedFix.charAt(0).toLowerCase() + suggestedFix.slice(1);
  
  const lines = [
    `**${severityLabel} - ${bugType}**`,
    '',
    issue.bug_description,
    '',
    `Consider ${fixText}${fixText.endsWith('.') || fixText.endsWith(':') ? '' : ':'}`,
  ];
  
  if (issue.suggested_code && issue.suggested_code.trim()) {
    lines.push('', '```suggestion', issue.suggested_code, '```');
  }
  
  lines.push('', '---', '<sub>Reviewed by NhoNH</sub>');
  
  return lines.join('\n');
}

/**
 * Format PR summary body using Template C (Human Conversational)
 * Clean table, no emojis, professional signature
 */
function formatSummaryBody(issues: any[], botName: string): string {
  const highCount = issues.filter(i => i.severity === 'HIGH').length;
  const mediumCount = issues.filter(i => i.severity === 'MEDIUM').length;
  const lowCount = issues.filter(i => i.severity === 'LOW').length;
  
  const lines = [
    '## PR Review Summary',
    '',
    '| Severity | Count |',
    '|----------|-------|',
    `| **High** | ${highCount} |`,
    `| **Medium** | ${mediumCount} |`,
    `| **Low** | ${lowCount} |`,
    '',
    `**Total:** ${issues.length} issues identified`,
    '',
    '---',
    `<sub>Reviewed by ${botName}</sub>`,
  ];
  
  return lines.join('\n');
}

export const submitPrReview = async (
  url: string, 
  token: string, 
  issues: any[], 
  botName: string
): Promise<void> => {
  const info = parseGitHubUrl(url);
  if (!info) throw new Error("Invalid GitHub PR URL");

  const reviewComments = issues.map((issue) => {
    const rawLine = issue.line_numbers?.toString().split('-').pop() || '1';
    const targetLine = parseInt(rawLine, 10);

    return {
      path: issue.file_name,
      line: isNaN(targetLine) ? 1 : targetLine,
      body: formatCommentBody(issue),
    };
  });

  const bodySummary = formatSummaryBody(issues, botName);

  const response = await fetch(
    `https://api.github.com/repos/${info.owner}/${info.repo}/pulls/${info.pullNumber}/reviews`,
    {
      method: "POST",
      headers: {
        Authorization: `token ${token}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github.v1+json",
      },
      body: JSON.stringify({
        body: bodySummary,
        event: "COMMENT", // You could change this to "REQUEST_CHANGES" if issues.length > 0
        comments: reviewComments,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Unknown error" }));
    throw new Error(`GitHub API Error: ${error.message || response.statusText}`);
  }
};
