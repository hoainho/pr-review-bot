export interface JiraConfluenceContext {
  jiraBaseUrl: string;
  jiraEmail: string;
  jiraToken: string;
  confluenceBaseUrl?: string;
  confluenceToken?: string;
}

export const fetchJiraTicketSimple = async (
  context: JiraConfluenceContext,
  ticketKey: string
): Promise<any> => {
  const auth = btoa(`${context.jiraEmail}:${context.jiraToken}`);
  
  const response = await fetch(
    `/api/jira/issue/${ticketKey}?target=${encodeURIComponent(context.jiraBaseUrl)}/rest/api/3`,
    {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Jira API failed: ${response.statusText}. Please ensure Vite dev server is running.`);
  }

  const data = await response.json();
  
  const storyPointsField = Object.keys(data.fields).find(
    key => key.toLowerCase().includes('story') && key.toLowerCase().includes('point')
  );

  return {
    id: data.id,
    key: data.key,
    summary: data.fields.summary,
    description: data.fields.description?.content?.map((block: any) =>
      block.content?.map((text: any) => text.text || '').join('') || ''
    ).join('\n') || data.fields.description || '',
    status: data.fields.status?.name || 'Unknown',
    priority: data.fields.priority?.name || 'Medium',
    labels: data.fields.labels || [],
    storyPoints: storyPointsField ? data.fields[storyPointsField] : undefined,
    assignee: data.fields.assignee?.displayName,
    reporter: data.fields.reporter?.displayName,
    created: data.fields.created,
    updated: data.fields.updated,
    components: data.fields.components?.map((c: any) => c.name),
    project: data.fields.project?.key || '',
  };
};

export const analyzeWithJiraContext = async (
  diff: string,
  jiraContext?: JiraConfluenceContext
): Promise<any> => {
  if (!jiraContext) {
    console.log('[Simple Jira] Jira context not configured');
    return { issues: [] };
  }

  try {
    const ticketKeyMatch = diff.match(/\b([A-Z0-9]{1,10})[-_\s]\b([0-9]{1,10})\b/);
    if (ticketKeyMatch) {
      const ticketKey = ticketKeyMatch[1];
      console.log(`[Simple Jira] Found ticket key: ${ticketKey}`);
      
      const ticketData = await fetchJiraTicketSimple(jiraContext, ticketKey);
      console.log(`[Simple Jira] Ticket fetched: ${ticketData.summary}`);
      
      return {
        issues: [{
          bug_description: `This PR references Jira ticket ${ticketKey}. Please review the ticket requirements before proceeding.`,
          severity: 'LOW',
          bug_type: 'OTHER',
          file_name: 'PR',
          line_numbers: 'N/A',
          snippet: `Ticket: ${ticketKey}`,
          suggested_fix: 'Verify ticket requirements match PR changes.',
          suggested_code: '// Check ticket: ' + ticketKey
        }]
      };
    } else {
      console.log('[Simple Jira] No Jira ticket found in PR');
      return { issues: [] };
    }
  } catch (error) {
    console.error('[Simple Jira] Analysis failed:', error);
    throw error;
  }
};