export interface JiraConfluenceContext {
  jiraBaseUrl: string;
  jiraEmail: string;
  jiraToken: string;
  confluenceBaseUrl?: string;
  confluenceToken?: string;
}

export interface JiraTicket {
  key: string;
  summary: string;
  description: string;
  status: string;
  priority: string;
}

export interface ConfluenceDoc {
  title: string;
  type: string;
  summary: string;
  url?: string;
  excerpt?: string;
}

export interface PRDContext {
  tickets: JiraTicket[];
  documentation: ConfluenceDoc[];
}

export interface JiraFetchResult {
  context: PRDContext | null;
  ticketKeysFound: string[];
  errors: string[];
}

export async function fetchAutoDiscoveredContext(
  jiraContext: JiraConfluenceContext,
  diff: string,
  prTitle: string
): Promise<JiraFetchResult> {
  const errors: string[] = [];
  
  try {
    const ticketKeyRegex = /\b[A-Z][A-Z0-9]*-\d+\b/g;
    const prText = `${prTitle} ${diff}`;
    const ticketKeys = [...new Set(prText.match(ticketKeyRegex) || [])];
    
    console.log('[Jira] Searching for ticket keys in PR title and diff...');
    console.log('[Jira] Found ticket keys:', ticketKeys.length > 0 ? ticketKeys.join(', ') : 'none');
    
    if (ticketKeys.length === 0) {
      return { 
        context: null, 
        ticketKeysFound: [], 
        errors: ['No Jira ticket keys found in PR title or diff (format: ABC-123)'] 
      };
    }

    const tickets = [];
    const documentation = [];

    for (const key of ticketKeys) {
      try {
        console.log(`[Jira] Fetching ticket ${key}...`);
        const ticketData = await fetchJiraTicket(jiraContext, key);
        if (ticketData) {
          tickets.push(ticketData);
          console.log(`[Jira] ✓ Fetched ticket ${key}: ${ticketData.summary}`);
        }
      } catch (error) {
        const errMsg = `Failed to fetch ticket ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.warn(`[Jira] ${errMsg}`);
        errors.push(errMsg);
      }
    }

    if (jiraContext.confluenceBaseUrl && jiraContext.confluenceToken) {
      try {
        console.log('[Confluence] Searching for related documentation...');
        const confluenceDocs = await fetchConfluenceDocumentation(jiraContext, ticketKeys);
        documentation.push(...confluenceDocs);
        console.log(`[Confluence] Found ${confluenceDocs.length} related documents`);
      } catch (error) {
        const errMsg = `Failed to fetch Confluence docs: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.warn(`[Confluence] ${errMsg}`);
        errors.push(errMsg);
      }
    }

    return {
      context: { tickets, documentation },
      ticketKeysFound: ticketKeys,
      errors
    };
  } catch (error) {
    console.error('[Jira] Error in fetchAutoDiscoveredContext:', error);
    return { 
      context: null, 
      ticketKeysFound: [], 
      errors: [`Jira integration error: ${error instanceof Error ? error.message : 'Unknown error'}`] 
    };
  }
}

export async function formatPRDContextForPrompt(context: PRDContext): Promise<string> {
  if (!context) {
    return '\nNo PRD context available.\n';
  }

  let contextString = '\n=== PROJECT DOCUMENTATION CONTEXT ===\n\n';

  if (context.tickets.length > 0) {
    contextString += '📋 RELATED JIRA TICKETS:\n';
    for (const ticket of context.tickets) {
      contextString += `\n- ${ticket.key}: ${ticket.summary}\n`;
      contextString += `  Status: ${ticket.status}\n`;
      const description = ticket.description || 'No description provided';
      console.log('[DEBUG] Processing ticket:', ticket.key, 'Description type:', typeof description, 'Description value:', description);
      const descriptionPreview = typeof description === 'string' ? description.substring(0, 200) : String(description).substring(0, 200);
      contextString += `  Description: ${descriptionPreview}...\n`;
    }
  }

  if (context.documentation.length > 0) {
    contextString += '\n📚 RELATED DOCUMENTATION:\n';
    for (const doc of context.documentation) {
      contextString += `\n- ${doc.title}\n`;
      contextString += `  Type: ${doc.type}\n`;
      const summary = doc.summary || 'No summary provided';
      console.log('[DEBUG] Processing doc:', doc.title, 'Summary type:', typeof summary, 'Summary value:', summary);
      const summaryPreview = typeof summary === 'string' ? summary.substring(0, 150) : String(summary).substring(0, 150);
      contextString += `  Summary: ${summaryPreview}...\n`;
    }
  }

  return contextString + '\n';
}

async function fetchJiraTicket(jiraContext: JiraConfluenceContext, ticketKey: string): Promise<JiraTicket> {
  const targetUrl = `${jiraContext.jiraBaseUrl}/rest/api/3/issue/${ticketKey}`;
  
  // Use Vite proxy to avoid CORS
  const proxyUrl = `/api/jira?target=${encodeURIComponent(targetUrl)}`;
  
  const response = await fetch(proxyUrl, {
    headers: {
      'Authorization': `Basic ${btoa(`${jiraContext.jiraEmail}:${jiraContext.jiraToken}`)}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ticket ${ticketKey}: ${response.statusText}`);
  }

  const data = await response.json();
  
  // Safely extract fields with null checks
  const fields = data.fields || {};
  const statusObj = fields.status || {};
  const priorityObj = fields.priority || {};
  
  return {
    key: data.key || 'Unknown',
    summary: fields.summary || 'No summary provided',
    description: fields.description || 'No description provided',
    status: statusObj.name || 'Unknown status',
    priority: priorityObj.name || 'Unknown priority',
  };
}

function extractConfluenceBaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return url.replace(/\/wiki\/.*$/, '').replace(/\/$/, '');
  }
}

function parseConfluencePageUrl(url: string): { baseUrl: string; pageId: string | null; spaceKey: string | null; pageTitle: string | null } {
  try {
    const parsed = new URL(url);
    const baseUrl = `${parsed.protocol}//${parsed.host}`;
    
    // Pattern 1: /wiki/spaces/SPACE/pages/123456/Page+Title
    const spacePagesMatch = url.match(/\/wiki\/spaces\/([^/]+)\/pages\/(\d+)(?:\/([^?#]+))?/);
    if (spacePagesMatch) {
      return {
        baseUrl,
        pageId: spacePagesMatch[2],
        spaceKey: spacePagesMatch[1],
        pageTitle: spacePagesMatch[3] ? decodeURIComponent(spacePagesMatch[3].replace(/\+/g, ' ')) : null
      };
    }
    
    // Pattern 2: /wiki/pages/viewpage.action?pageId=123456
    const viewPageMatch = url.match(/pageId=(\d+)/);
    if (viewPageMatch) {
      const spaceKeyMatch = url.match(/spaceKey=([^&]+)/);
      return {
        baseUrl,
        pageId: viewPageMatch[1],
        spaceKey: spaceKeyMatch ? decodeURIComponent(spaceKeyMatch[1]) : null,
        pageTitle: null
      };
    }
    
    // Pattern 3: /wiki/display/SPACE/Page+Title (old Confluence URL format)
    const displayMatch = url.match(/\/wiki\/display\/([^/]+)\/([^?#]+)/);
    if (displayMatch) {
      return {
        baseUrl,
        pageId: null,
        spaceKey: displayMatch[1],
        pageTitle: decodeURIComponent(displayMatch[2].replace(/\+/g, ' '))
      };
    }
    
    return { baseUrl, pageId: null, spaceKey: null, pageTitle: null };
  } catch {
    return { baseUrl: url, pageId: null, spaceKey: null, pageTitle: null };
  }
}

function extractTextFromHtml(html: string): string {
  let text = html;
  
  // Step 1: Handle Confluence-specific macros and structured content
  // Extract text from ac:parameter tags (macro parameters often contain useful info)
  text = text.replace(/<ac:parameter[^>]*>([^<]*)<\/ac:parameter>/gi, ' $1 ');
  
  // Extract text from ac:plain-text-body (code blocks, etc.)
  text = text.replace(/<ac:plain-text-body[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/ac:plain-text-body>/gi, ' $1 ');
  
  // Extract text from ac:rich-text-body (rich content inside macros)
  text = text.replace(/<ac:rich-text-body[^>]*>([\s\S]*?)<\/ac:rich-text-body>/gi, ' $1 ');
  
  // Handle ac:link - extract the link text
  text = text.replace(/<ac:link[^>]*>[\s\S]*?<ri:page[^>]*ri:content-title="([^"]*)"[^>]*\/>[\s\S]*?<\/ac:link>/gi, ' $1 ');
  text = text.replace(/<ac:link[^>]*>[\s\S]*?<ac:plain-text-link-body><!\[CDATA\[([\s\S]*?)\]\]><\/ac:plain-text-link-body>[\s\S]*?<\/ac:link>/gi, ' $1 ');
  
  // Handle ri:attachment - extract filename
  text = text.replace(/<ri:attachment[^>]*ri:filename="([^"]*)"[^>]*\/?>/gi, ' [Attachment: $1] ');
  
  // Handle ac:image - note that there's an image
  text = text.replace(/<ac:image[^>]*>[\s\S]*?<ri:attachment[^>]*ri:filename="([^"]*)"[^>]*\/>[\s\S]*?<\/ac:image>/gi, ' [Image: $1] ');
  
  // Handle ac:emoticon - convert to text representation
  text = text.replace(/<ac:emoticon[^>]*ac:name="([^"]*)"[^>]*\/?>/gi, ' :$1: ');
  
  // Handle task lists (ac:task-list, ac:task)
  text = text.replace(/<ac:task-status>complete<\/ac:task-status>/gi, '[✓]');
  text = text.replace(/<ac:task-status>incomplete<\/ac:task-status>/gi, '[ ]');
  text = text.replace(/<ac:task-body>([\s\S]*?)<\/ac:task-body>/gi, ' $1 ');
  
  // Handle status macros
  text = text.replace(/<ac:structured-macro[^>]*ac:name="status"[^>]*>[\s\S]*?<ac:parameter[^>]*ac:name="title"[^>]*>([^<]*)<\/ac:parameter>[\s\S]*?<\/ac:structured-macro>/gi, ' [Status: $1] ');
  
  // Handle info/warning/note panels - preserve the content
  text = text.replace(/<ac:structured-macro[^>]*ac:name="(info|warning|note|tip)"[^>]*>([\s\S]*?)<\/ac:structured-macro>/gi, ' [$1: $2] ');
  
  // Remove remaining ac: and ri: tags but keep content between them
  text = text.replace(/<\/?ac:[^>]*>/gi, ' ');
  text = text.replace(/<\/?ri:[^>]*>/gi, ' ');
  
  // Step 2: Handle standard HTML elements
  // Add line breaks for block elements
  text = text.replace(/<\/(p|div|h[1-6]|li|tr|br|hr)[^>]*>/gi, '\n');
  text = text.replace(/<(br|hr)[^>]*\/?>/gi, '\n');
  
  // Handle table cells - add spacing
  text = text.replace(/<\/(td|th)[^>]*>/gi, ' | ');
  
  // Handle list items
  text = text.replace(/<li[^>]*>/gi, '\n• ');
  
  // Step 3: Remove all remaining HTML tags
  text = text.replace(/<[^>]*>/g, ' ');
  
  // Step 4: Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&apos;/g, "'");
  text = text.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
  text = text.replace(/&#x([a-fA-F0-9]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  
  // Step 5: Clean up whitespace while preserving paragraph structure
  text = text.replace(/[ \t]+/g, ' ');  // Multiple spaces/tabs to single space
  text = text.replace(/\n[ \t]+/g, '\n');  // Remove leading spaces on lines
  text = text.replace(/[ \t]+\n/g, '\n');  // Remove trailing spaces on lines
  text = text.replace(/\n{3,}/g, '\n\n');  // Max 2 consecutive newlines
  
  return text.trim();
}

interface ConfluencePageResult {
  content: string | null;
  title: string;
  id: string;
}

async function fetchConfluencePageById(
  baseUrl: string, 
  pageId: string, 
  auth: string
): Promise<ConfluencePageResult | null> {
  const contentUrl = `${baseUrl}/wiki/rest/api/content/${pageId}?expand=body.view,body.storage,title`;
  const proxyUrl = `/api/confluence?target=${encodeURIComponent(contentUrl)}`;
  
  console.log(`[Confluence] Request URL: ${proxyUrl.substring(0, 100)}...`);
  console.log(`[Confluence] Target URL: ${contentUrl}`);
  console.log(`[Confluence] Auth header present: ${!!auth}, length: ${auth?.length || 0}`);
  
  try {
    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'Authorization': auth,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });
    
    console.log(`[Confluence] Response status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      const bodyView = data.body?.view?.value;
      const bodyStorage = data.body?.storage?.value;
      const title = data.title || 'Untitled';
      
      console.log(`[Confluence] Page ${pageId} response:`, {
        title,
        hasViewBody: !!bodyView,
        viewBodyLength: bodyView?.length || 0,
        hasStorageBody: !!bodyStorage,
        storageBodyLength: bodyStorage?.length || 0,
      });
      
      const bodyHtml = bodyView || bodyStorage;
      if (bodyHtml) {
        const extracted = extractTextFromHtml(bodyHtml);
        console.log(`[Confluence] Extracted ${extracted.length} chars from page ${pageId}`);
        console.log(`[Confluence] Preview: ${extracted.substring(0, 200)}...`);
        return { content: extracted, title, id: pageId };
      }
      return { content: null, title, id: pageId };
    } else {
      const errorText = await response.text().catch(() => 'Could not read error body');
      console.warn(`[Confluence] Failed to fetch page ${pageId}: ${response.status} ${response.statusText}`);
      console.warn(`[Confluence] Error response: ${errorText.substring(0, 500)}`);
    }
  } catch (error) {
    console.error(`[Confluence] Network error fetching page ${pageId}:`, error);
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      console.error(`[Confluence] This is likely a CORS or network issue. Check:`);
      console.error(`  1. Vite dev server is running`);
      console.error(`  2. Proxy config in vite.config.ts is correct`);
      console.error(`  3. Target URL is accessible: ${baseUrl}`);
    }
  }
  return null;
}

async function fetchConfluencePageByTitle(
  baseUrl: string,
  spaceKey: string,
  pageTitle: string,
  auth: string
): Promise<ConfluencePageResult | null> {
  const searchUrl = `${baseUrl}/wiki/rest/api/content?spaceKey=${encodeURIComponent(spaceKey)}&title=${encodeURIComponent(pageTitle)}&expand=body.view,body.storage`;
  const proxyUrl = `/api/confluence?target=${encodeURIComponent(searchUrl)}`;
  
  console.log(`[Confluence] Fetching page by title: "${pageTitle}" in space "${spaceKey}"...`);
  
  try {
    const response = await fetch(proxyUrl, {
      headers: {
        'Authorization': auth,
        'Accept': 'application/json',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      const page = data.results?.[0];
      
      if (page) {
        const bodyView = page.body?.view?.value;
        const bodyStorage = page.body?.storage?.value;
        const title = page.title || pageTitle;
        const id = page.id;
        
        console.log(`[Confluence] Found page "${title}" (ID: ${id})`);
        
        const bodyHtml = bodyView || bodyStorage;
        if (bodyHtml) {
          const extracted = extractTextFromHtml(bodyHtml);
          console.log(`[Confluence] Extracted ${extracted.length} chars`);
          return { content: extracted, title, id };
        }
        return { content: null, title, id };
      } else {
        console.warn(`[Confluence] Page "${pageTitle}" not found in space "${spaceKey}"`);
      }
    } else {
      console.warn(`[Confluence] Failed to fetch page by title: ${response.status}`);
    }
  } catch (error) {
    console.warn(`[Confluence] Error fetching page by title:`, error);
  }
  return null;
}

function parseMultipleUrls(input: string): string[] {
  return input
    .split(/[\n,]/)
    .map(url => url.trim())
    .filter(url => url.length > 0 && url.startsWith('http'));
}

async function fetchConfluenceDocumentation(jiraContext: JiraConfluenceContext, _ticketKeys: string[]): Promise<ConfluenceDoc[]> {
  if (!jiraContext.confluenceBaseUrl || !jiraContext.confluenceToken) {
    return [];
  }

  const authHeader = `Basic ${btoa(`${jiraContext.jiraEmail}:${jiraContext.confluenceToken}`)}`;
  const documentation: ConfluenceDoc[] = [];
  
  const urls = parseMultipleUrls(jiraContext.confluenceBaseUrl);
  console.log(`[Confluence] Found ${urls.length} URL(s) to fetch`);
  
  for (const url of urls) {
    const parsed = parseConfluencePageUrl(url);
    console.log(`[Confluence] Parsing URL:`, { url: url.substring(0, 80) + '...', ...parsed });
    
    let pageResult: ConfluencePageResult | null = null;
    
    if (parsed.pageId) {
      console.log(`[Confluence] Fetching page by ID: ${parsed.pageId}`);
      pageResult = await fetchConfluencePageById(parsed.baseUrl, parsed.pageId, authHeader);
    } else if (parsed.spaceKey && parsed.pageTitle) {
      console.log(`[Confluence] Fetching page by title: "${parsed.pageTitle}" in space "${parsed.spaceKey}"`);
      pageResult = await fetchConfluencePageByTitle(parsed.baseUrl, parsed.spaceKey, parsed.pageTitle, authHeader);
    } else {
      console.warn(`[Confluence] Skipping invalid URL: ${url.substring(0, 60)}...`);
      console.warn(`[Confluence] Expected formats:`);
      console.warn(`  - https://domain.atlassian.net/wiki/spaces/SPACE/pages/123456/Page+Title`);
      console.warn(`  - https://domain.atlassian.net/wiki/display/SPACE/Page+Title`);
      continue;
    }
    
    if (pageResult) {
      const summary = pageResult.content || 'No content available';
      console.log(`[Confluence] ✓ Fetched "${pageResult.title}" - ${summary.length} chars`);
      
      documentation.push({
        title: pageResult.title,
        type: 'Confluence Page',
        summary: summary,
        url: url,
      });
    }
  }
  
  console.log(`[Confluence] Total: ${documentation.length} page(s) fetched successfully`);
  return documentation;
}