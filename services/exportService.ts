import type { PRIssue, ExportOptions, ExportResult, ReviewHistory } from '../types';

const escapeHtml = (text: string): string => {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, m => map[m]);
};

const formatDate = (timestamp?: number): string => {
  const date = timestamp ? new Date(timestamp) : new Date();
  return date.toISOString().split('T')[0];
};

export const exportToMarkdown = (
  issues: PRIssue[],
  options: ExportOptions,
  metadata?: { prUrl?: string; prTitle?: string; author?: string }
): string => {
  const filteredIssues = filterIssues(issues, options);
  
  let md = `# PR Review Report\n\n`;
  
  if (options.include_metadata && metadata) {
    md += `## Metadata\n\n`;
    md += `- **Date**: ${formatDate()}\n`;
    if (metadata.prUrl) md += `- **PR URL**: ${metadata.prUrl}\n`;
    if (metadata.prTitle) md += `- **Title**: ${metadata.prTitle}\n`;
    if (metadata.author) md += `- **Author**: ${metadata.author}\n`;
    md += `\n`;
  }
  
  if (options.include_statistics) {
    md += `## Summary Statistics\n\n`;
    md += `| Metric | Count |\n`;
    md += `|--------|-------|\n`;
    md += `| Total Issues | ${issues.length} |\n`;
    md += `| High Severity | ${issues.filter(i => i.severity === 'HIGH').length} |\n`;
    md += `| Medium Severity | ${issues.filter(i => i.severity === 'MEDIUM').length} |\n`;
    md += `| Low Severity | ${issues.filter(i => i.severity === 'LOW').length} |\n`;
    md += `| Approved | ${issues.filter(i => i.approval_status === 'approved').length} |\n`;
    md += `| Rejected | ${issues.filter(i => i.approval_status === 'rejected').length} |\n`;
    md += `\n`;
  }
  
  md += `## Issues (${filteredIssues.length})\n\n`;
  
  for (const [idx, issue] of filteredIssues.entries()) {
    const severityEmoji = issue.severity === 'HIGH' ? '🔴' : issue.severity === 'MEDIUM' ? '🟡' : '🔵';
    const statusEmoji = issue.approval_status === 'approved' ? '✅' : issue.approval_status === 'rejected' ? '❌' : '⏳';
    
    md += `### ${idx + 1}. ${severityEmoji} ${issue.bug_type.replace('_', ' ')} ${statusEmoji}\n\n`;
    md += `**File**: \`${issue.file_name}\` | **Line**: ${issue.line_numbers} | **Severity**: ${issue.severity}\n\n`;
    md += `**Description**: ${issue.bug_description}\n\n`;
    
    if (options.template !== 'minimal') {
      md += `**Original Code**:\n\`\`\`typescript\n${issue.snippet}\n\`\`\`\n\n`;
      md += `**Suggested Fix**: ${issue.suggested_fix}\n\n`;
      md += `**Suggested Code**:\n\`\`\`typescript\n${issue.suggested_code}\n\`\`\`\n\n`;
    }
    
    if (issue.rejection_reason) {
      md += `**Rejection Reason**: ${issue.rejection_reason}\n\n`;
    }
    
    md += `---\n\n`;
  }
  
  return md;
};

export const exportToHtml = (
  issues: PRIssue[],
  options: ExportOptions,
  metadata?: { prUrl?: string; prTitle?: string; author?: string }
): string => {
  const filteredIssues = filterIssues(issues, options);
  
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PR Review Report</title>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --text: #e2e8f0;
      --text-muted: #94a3b8;
      --accent: #6366f1;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); padding: 2rem; line-height: 1.6; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { font-size: 2rem; margin-bottom: 1.5rem; color: var(--accent); }
    h2 { font-size: 1.25rem; margin: 1.5rem 0 1rem; color: var(--text); border-bottom: 1px solid #334155; padding-bottom: 0.5rem; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .stat { background: var(--card-bg); padding: 1rem; border-radius: 0.5rem; text-align: center; }
    .stat-value { font-size: 2rem; font-weight: bold; color: var(--accent); }
    .stat-label { font-size: 0.875rem; color: var(--text-muted); }
    .issue { background: var(--card-bg); border-radius: 0.75rem; padding: 1.5rem; margin-bottom: 1rem; border-left: 4px solid var(--accent); }
    .issue.high { border-left-color: var(--danger); }
    .issue.medium { border-left-color: var(--warning); }
    .issue.low { border-left-color: var(--success); }
    .issue-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem; }
    .badge { padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: bold; text-transform: uppercase; }
    .badge.high { background: rgba(239, 68, 68, 0.2); color: var(--danger); }
    .badge.medium { background: rgba(245, 158, 11, 0.2); color: var(--warning); }
    .badge.low { background: rgba(16, 185, 129, 0.2); color: var(--success); }
    .badge.approved { background: rgba(16, 185, 129, 0.2); color: var(--success); }
    .badge.rejected { background: rgba(239, 68, 68, 0.1); color: #f87171; }
    .badge.pending { background: rgba(245, 158, 11, 0.2); color: var(--warning); }
    .file-info { font-family: monospace; font-size: 0.875rem; color: var(--text-muted); }
    pre { background: #0f172a; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; font-size: 0.875rem; margin: 1rem 0; }
    code { font-family: 'Fira Code', monospace; color: #a5b4fc; }
    .description { margin: 1rem 0; }
    .suggestion { background: rgba(99, 102, 241, 0.1); padding: 1rem; border-radius: 0.5rem; margin-top: 1rem; }
    .suggestion-label { font-weight: bold; color: var(--accent); margin-bottom: 0.5rem; }
    @media print { body { background: white; color: black; } .issue { border: 1px solid #ccc; } }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔍 PR Review Report</h1>`;
  
  if (options.include_metadata && metadata) {
    html += `
    <h2>📋 Metadata</h2>
    <p><strong>Date:</strong> ${formatDate()}</p>
    ${metadata.prUrl ? `<p><strong>PR URL:</strong> <a href="${escapeHtml(metadata.prUrl)}">${escapeHtml(metadata.prUrl)}</a></p>` : ''}
    ${metadata.prTitle ? `<p><strong>Title:</strong> ${escapeHtml(metadata.prTitle)}</p>` : ''}
    ${metadata.author ? `<p><strong>Author:</strong> ${escapeHtml(metadata.author)}</p>` : ''}`;
  }
  
  if (options.include_statistics) {
    html += `
    <h2>📊 Statistics</h2>
    <div class="stats">
      <div class="stat"><div class="stat-value">${issues.length}</div><div class="stat-label">Total Issues</div></div>
      <div class="stat"><div class="stat-value" style="color: var(--danger)">${issues.filter(i => i.severity === 'HIGH').length}</div><div class="stat-label">High Severity</div></div>
      <div class="stat"><div class="stat-value" style="color: var(--warning)">${issues.filter(i => i.severity === 'MEDIUM').length}</div><div class="stat-label">Medium Severity</div></div>
      <div class="stat"><div class="stat-value" style="color: var(--success)">${issues.filter(i => i.approval_status === 'approved').length}</div><div class="stat-label">Approved</div></div>
    </div>`;
  }
  
  html += `<h2>🐛 Issues (${filteredIssues.length})</h2>`;
  
  for (const issue of filteredIssues) {
    const severityClass = issue.severity.toLowerCase();
    const statusClass = issue.approval_status || 'pending';
    
    html += `
    <div class="issue ${severityClass}">
      <div class="issue-header">
        <div>
          <span class="badge ${severityClass}">${issue.severity}</span>
          <span class="badge">${issue.bug_type.replace('_', ' ')}</span>
          <span class="badge ${statusClass}">${statusClass}</span>
        </div>
        <span class="file-info">${escapeHtml(issue.file_name)}:${issue.line_numbers}</span>
      </div>
      <p class="description">${escapeHtml(issue.bug_description)}</p>`;
    
    if (options.template !== 'minimal') {
      html += `
      <pre><code>${escapeHtml(issue.snippet)}</code></pre>
      <div class="suggestion">
        <div class="suggestion-label">💡 Suggested Fix</div>
        <p>${escapeHtml(issue.suggested_fix)}</p>
        <pre><code>${escapeHtml(issue.suggested_code)}</code></pre>
      </div>`;
    }
    
    html += `</div>`;
  }
  
  html += `
  </div>
</body>
</html>`;
  
  return html;
};

export const exportToJson = (
  issues: PRIssue[],
  options: ExportOptions,
  metadata?: { prUrl?: string; prTitle?: string; author?: string }
): string => {
  const filteredIssues = filterIssues(issues, options);
  
  const exportData = {
    exportedAt: new Date().toISOString(),
    metadata: options.include_metadata ? metadata : undefined,
    statistics: options.include_statistics ? {
      total: issues.length,
      bySeverity: {
        high: issues.filter(i => i.severity === 'HIGH').length,
        medium: issues.filter(i => i.severity === 'MEDIUM').length,
        low: issues.filter(i => i.severity === 'LOW').length,
      },
      byStatus: {
        approved: issues.filter(i => i.approval_status === 'approved').length,
        rejected: issues.filter(i => i.approval_status === 'rejected').length,
        pending: issues.filter(i => i.approval_status === 'pending').length,
      },
    } : undefined,
    issues: filteredIssues,
  };
  
  return JSON.stringify(exportData, null, 2);
};

const filterIssues = (issues: PRIssue[], options: ExportOptions): PRIssue[] => {
  let filtered = [...issues];
  
  if (options.include_approved_only) {
    filtered = filtered.filter(i => i.approval_status === 'approved');
  }
  
  if (options.include_rejected_only) {
    filtered = filtered.filter(i => i.approval_status === 'rejected');
  }
  
  return filtered;
};

export const exportReview = (
  issues: PRIssue[],
  options: ExportOptions,
  metadata?: { prUrl?: string; prTitle?: string; author?: string }
): ExportResult => {
  let content: string;
  let filename: string;
  const date = formatDate();
  
  switch (options.format) {
    case 'markdown':
      content = exportToMarkdown(issues, options, metadata);
      filename = `pr-review-${date}.md`;
      break;
    case 'html':
      content = exportToHtml(issues, options, metadata);
      filename = `pr-review-${date}.html`;
      break;
    case 'json':
      content = exportToJson(issues, options, metadata);
      filename = `pr-review-${date}.json`;
      break;
    case 'pdf':
      content = exportToHtml(issues, options, metadata);
      filename = `pr-review-${date}.html`;
      break;
    default:
      content = exportToMarkdown(issues, options, metadata);
      filename = `pr-review-${date}.md`;
  }
  
  return {
    content,
    filename,
    format: options.format,
    size: new Blob([content]).size,
  };
};

export const downloadExport = (result: ExportResult): void => {
  const blob = new Blob([result.content], { 
    type: result.format === 'json' ? 'application/json' : 
          result.format === 'html' ? 'text/html' : 
          'text/markdown' 
  });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const generateAnalyticsReport = (history: ReviewHistory[]): string => {
  if (history.length === 0) return 'No review history available.';
  
  const totalIssues = history.reduce((sum, h) => sum + h.total_issues, 0);
  const avgIssues = totalIssues / history.length;
  const totalApproved = history.reduce((sum, h) => sum + h.approved_comments, 0);
  const avgApprovalRate = totalApproved / totalIssues;
  
  let report = `# Review Analytics Report\n\n`;
  report += `## Overview\n`;
  report += `- Total Reviews: ${history.length}\n`;
  report += `- Total Issues Found: ${totalIssues}\n`;
  report += `- Average Issues/PR: ${avgIssues.toFixed(1)}\n`;
  report += `- Average Approval Rate: ${(avgApprovalRate * 100).toFixed(1)}%\n\n`;
  
  const issueTypes = new Map<string, number>();
  for (const h of history) {
    for (const [type, count] of Object.entries(h.issues_by_type)) {
      issueTypes.set(type, (issueTypes.get(type) || 0) + count);
    }
  }
  
  report += `## Most Common Issues\n`;
  const sortedTypes = [...issueTypes.entries()].sort((a, b) => b[1] - a[1]);
  for (const [type, count] of sortedTypes.slice(0, 10)) {
    report += `- ${type}: ${count}\n`;
  }
  
  return report;
};
