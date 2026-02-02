
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

export const fetchPrDiff = async (url: string, token: string): Promise<string> => {
  const info = parseGitHubUrl(url);
  if (!info) throw new Error("Invalid GitHub PR URL");

  const response = await fetch(
    `https://api.github.com/repos/${info.owner}/${info.repo}/pulls/${info.pullNumber}`,
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3.diff",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch PR diff: ${response.statusText}`);
  }

  return response.text();
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

const SEVERITY_ICONS: Record<string, string> = {
  HIGH: '🔴',
  MEDIUM: '🟡',
  LOW: '🟢',
};

const BUG_TYPE_LABELS: Record<string, string> = {
  RACE_CONDITION: 'Race Condition',
  STATE_MANAGEMENT: 'State Bug',
  MEMORY_LEAK: 'Memory Leak',
  SECURITY: 'Security',
  CRASH: 'Crash Risk',
  CORRUPTION: 'Data Corruption',
  PERFORMANCE: 'Performance',
  RESOURCE_LEAK: 'Resource Leak',
};

function formatCommentBody(issue: any): string {
  const severity = issue.severity || 'MEDIUM';
  const icon = SEVERITY_ICONS[severity] || '🟡';
  const bugType = BUG_TYPE_LABELS[issue.bug_type] || issue.bug_type?.replace(/_/g, ' ') || 'Issue';
  
  const lines = [
    `${icon} **${bugType}** | ${severity}`,
    '',
    issue.bug_description,
    '',
    `**Fix:** ${issue.suggested_fix}`,
  ];
  
  if (issue.suggested_code && issue.suggested_code.trim()) {
    lines.push('', '```suggestion', issue.suggested_code, '```');
  }
  
  return lines.join('\n');
}

function formatSummaryBody(issues: any[], botName: string): string {
  const highCount = issues.filter(i => i.severity === 'HIGH').length;
  const mediumCount = issues.filter(i => i.severity === 'MEDIUM').length;
  const lowCount = issues.filter(i => i.severity === 'LOW').length;
  
  const lines = [
    `## PR Review Summary`,
    '',
    `| Severity | Count |`,
    `|----------|-------|`,
    `| 🔴 High | ${highCount} |`,
    `| 🟡 Medium | ${mediumCount} |`,
    `| 🟢 Low | ${lowCount} |`,
    `| **Total** | **${issues.length}** |`,
    '',
    `_Review by ${botName}_`,
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
