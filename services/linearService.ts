/**
 * Linear Integration Service
 * 
 * Provides integration with Linear.app for fetching issue context
 * to enhance AI-powered code reviews with ticket information.
 * 
 * @module linearService
 */

export interface LinearContext {
  apiKey: string;
}

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  priorityLabel: string;
  labels: string[];
  url: string;
  teamName?: string;
  projectName?: string;
  estimate?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface LinearFetchResult {
  issues: LinearIssue[];
  issueIdsFound: string[];
  errors: string[];
}

// Linear GraphQL API endpoint
const LINEAR_API_URL = 'https://api.linear.app/graphql';

// Linear issue identifier pattern: TEAM-123 (1-10 uppercase letters, dash, 1-6 digits)
const LINEAR_ISSUE_PATTERN = /\b([A-Z]{1,10})-(\d{1,6})\b/g;

/**
 * Extract Linear issue identifiers from text
 * Pattern: TEAM-123 format (similar to Jira)
 */
export function parseLinearIssueIds(text: string): string[] {
  const matches = text.match(LINEAR_ISSUE_PATTERN) || [];
  return [...new Set(matches)];
}

/**
 * GraphQL query to fetch issue details by identifier
 * Linear's `id` argument accepts either the UUID or the human-readable identifier (e.g., "TEAM-123")
 */
const ISSUE_QUERY = `
  query IssueByIdentifier($identifier: String!) {
    issue(id: $identifier) {
      id
      identifier
      title
      description
      url
      priority
      priorityLabel
      estimate
      createdAt
      updatedAt
      state {
        name
        type
      }
      team {
        name
        key
      }
      project {
        name
      }
      labels {
        nodes {
          name
        }
      }
    }
  }
`;

/**
 * Fetch a single Linear issue by identifier
 */
async function fetchLinearIssue(
  context: LinearContext,
  identifier: string
): Promise<LinearIssue | null> {
  const proxyUrl = `/api/linear`;
  
  try {
    console.log(`[Linear] Fetching issue ${identifier}...`);
    
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': context.apiKey,
      },
      body: JSON.stringify({
        query: ISSUE_QUERY,
        variables: { identifier },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Linear API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (data.errors && data.errors.length > 0) {
      const errorMessage = data.errors.map((e: { message: string }) => e.message).join(', ');
      throw new Error(`Linear GraphQL error: ${errorMessage}`);
    }

    const issue = data.data?.issue;
    
    if (!issue) {
      console.log(`[Linear] Issue ${identifier} not found`);
      return null;
    }

    console.log(`[Linear] ✓ Fetched issue ${identifier}: ${issue.title}`);

    return {
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description || 'No description provided',
      status: issue.state?.name || 'Unknown',
      priority: String(issue.priority || 0),
      priorityLabel: issue.priorityLabel || 'No priority',
      labels: issue.labels?.nodes?.map((l: { name: string }) => l.name) || [],
      url: issue.url,
      teamName: issue.team?.name,
      projectName: issue.project?.name,
      estimate: issue.estimate,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
    };
  } catch (error) {
    console.error(`[Linear] Error fetching issue ${identifier}:`, error);
    throw error;
  }
}

/**
 * Auto-discover and fetch Linear issues from PR title and diff
 * Similar to Jira's fetchAutoDiscoveredContext
 */
export async function fetchLinearContext(
  context: LinearContext,
  diff: string,
  prTitle: string
): Promise<LinearFetchResult> {
  const errors: string[] = [];

  try {
    const prText = `${prTitle} ${diff}`;
    const issueIds = parseLinearIssueIds(prText);

    console.log('[Linear] Searching for issue IDs in PR title and diff...');
    console.log('[Linear] Found issue IDs:', issueIds.length > 0 ? issueIds.join(', ') : 'none');

    if (issueIds.length === 0) {
      return {
        issues: [],
        issueIdsFound: [],
        errors: ['No Linear issue IDs found in PR title or diff (format: TEAM-123)'],
      };
    }

    const issues: LinearIssue[] = [];

    for (const identifier of issueIds) {
      try {
        const issue = await fetchLinearIssue(context, identifier);
        if (issue) {
          issues.push(issue);
        }
      } catch (error) {
        const errMsg = `Failed to fetch issue ${identifier}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.warn(`[Linear] ${errMsg}`);
        errors.push(errMsg);
      }
    }

    return {
      issues,
      issueIdsFound: issueIds,
      errors,
    };
  } catch (error) {
    console.error('[Linear] Error in fetchLinearContext:', error);
    return {
      issues: [],
      issueIdsFound: [],
      errors: [`Linear integration error: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}

/**
 * Format Linear issues for AI prompt context
 * Similar to Jira's formatPRDContextForPrompt
 */
export function formatLinearContextForPrompt(result: LinearFetchResult): string {
  if (!result.issues || result.issues.length === 0) {
    return '\nNo Linear issue context available.\n';
  }

  let contextString = '\n=== LINEAR ISSUE CONTEXT ===\n\n';

  contextString += '🎯 LINKED LINEAR ISSUES:\n';
  
  for (const issue of result.issues) {
    contextString += `\n- ${issue.identifier}: ${issue.title}\n`;
    contextString += `  Status: ${issue.status}\n`;
    contextString += `  Priority: ${issue.priorityLabel}\n`;
    
    if (issue.teamName) {
      contextString += `  Team: ${issue.teamName}\n`;
    }
    
    if (issue.projectName) {
      contextString += `  Project: ${issue.projectName}\n`;
    }
    
    if (issue.labels.length > 0) {
      contextString += `  Labels: ${issue.labels.join(', ')}\n`;
    }
    
    if (issue.estimate) {
      contextString += `  Estimate: ${issue.estimate} points\n`;
    }
    
    const description = issue.description || 'No description provided';
    const descriptionPreview = typeof description === 'string' 
      ? description.substring(0, 300) 
      : String(description).substring(0, 300);
    contextString += `  Description: ${descriptionPreview}${description.length > 300 ? '...' : ''}\n`;
    
    contextString += `  URL: ${issue.url}\n`;
  }

  return contextString + '\n';
}

/**
 * Check if Linear context is properly configured
 */
export function isLinearContextConfigured(context: LinearContext | undefined): boolean {
  return !!(context && context.apiKey && context.apiKey.trim().length > 0);
}

/**
 * Validate Linear API key format
 * Linear API keys are typically 32+ character hex strings
 */
export function validateLinearApiKey(apiKey: string): { valid: boolean; message?: string } {
  if (!apiKey || apiKey.trim().length === 0) {
    return { valid: false, message: 'API key is required' };
  }

  const trimmedKey = apiKey.trim();
  
  if (trimmedKey.startsWith('lin_api_') || trimmedKey.length >= 32) {
    return { valid: true };
  }

  return { 
    valid: false, 
    message: 'Invalid API key format. Linear API keys typically start with "lin_api_" or are 32+ characters' 
  };
}

/**
 * Get priority color class for UI display
 */
export function getLinearPriorityColor(priorityLabel: string): string {
  switch (priorityLabel.toLowerCase()) {
    case 'urgent':
      return 'text-red-600 bg-red-50 border-red-200';
    case 'high':
      return 'text-orange-600 bg-orange-50 border-orange-200';
    case 'medium':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'low':
      return 'text-blue-600 bg-blue-50 border-blue-200';
    default:
      return 'text-slate-600 bg-slate-50 border-slate-200';
  }
}

/**
 * Get status color class for UI display
 */
export function getLinearStatusColor(status: string): string {
  const statusLower = status.toLowerCase();
  
  if (statusLower.includes('done') || statusLower.includes('complete')) {
    return 'text-green-600 bg-green-50 border-green-200';
  }
  if (statusLower.includes('progress') || statusLower.includes('review')) {
    return 'text-blue-600 bg-blue-50 border-blue-200';
  }
  if (statusLower.includes('blocked') || statusLower.includes('cancelled')) {
    return 'text-red-600 bg-red-50 border-red-200';
  }
  if (statusLower.includes('backlog') || statusLower.includes('todo')) {
    return 'text-slate-600 bg-slate-50 border-slate-200';
  }
  
  return 'text-purple-600 bg-purple-50 border-purple-200';
}
