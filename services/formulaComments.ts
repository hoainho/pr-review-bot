// Formula-based comment service for concise, structured PR feedback
// Transforms verbose AI analysis into short, actionable formula comments

export interface FormulaComment {
  emoji: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  type: string;
  title: string;
  location: string;
  component: string;
  impact: string;
  solution: string;
  codeFix: string;
  pattern?: string; // Reference to learned pattern
}

export interface CommentTemplate {
  format: string;
  fields: string[];
  maxLength: number;
}

export const COMMENT_TEMPLATES: Record<string, CommentTemplate> = {
  security: {
    format: '🔴 {severity} {type}: {title}',
    fields: ['severity', 'type', 'title'],
    maxLength: 80,
  },
  performance: {
    format: '⚡ {severity} {type}: {title}',
    fields: ['severity', 'type', 'title'],
    maxLength: 75,
  },
  crash: {
    format: '💥 {severity} {type}: {title}',
    fields: ['severity', 'type', 'title'],
    maxLength: 80,
  },
  default: {
    format: '🔍 {severity} {type}: {title}',
    fields: ['severity', 'type', 'title'],
    maxLength: 80,
  },
};

export const FORMULA_TEMPLATE = `🔴 [SEVERITY] [TYPE]: {title}
📍 {location} | {component}
⚡ {impact}
💡 {solution}
🔧 {code_snippet}`;

export const MINI_FORMULA_TEMPLATE = `🔴 {severity} {type}: {title}
📍 {file}:{line} | {impact}
💡 {solution}`;

export const formatFormulaComment = (
  issue: any,
  template: string = FORMULA_TEMPLATE
): FormulaComment => {
  const severity = issue.severity || 'MEDIUM';
  const type = issue.bug_type?.replace('_', ' ')?.toUpperCase() || 'ISSUE';
  const fileName = issue.file_name || 'unknown';
  const lineNumbers = issue.line_numbers || 'unknown';

  const getEmoji = (bugType: string, severity: string): string => {
    switch (bugType.toLowerCase()) {
      case 'security': return '🔴';
      case 'performance': return '⚡';
      case 'crash': return '💥';
      case 'race_condition': return '🏁';
      case 'memory_leak': return '🧠';
      case 'state_management': return '🔄';
      case 'corruption': return '🗑️';
      case 'resource_leak': return '💧';
      default: return '🔍';
    }
  };

  const emoji = getEmoji(type, severity);
  
  const title = issue.bug_description
    ?.split('.')[0]
    ?.substring(0, 60)
    ?.trim() || 'Code issue detected';

  const component = extractComponentName(fileName);
  
  const impact = issue.suggested_fix
    ?.split('.')[0]
    ?.substring(0, 100)
    ?.trim() || 'May cause production issues';

  const solution = issue.suggested_fix
    ?.split('.')[0]
    ?.substring(0, 80)
    ?.trim() || 'Fix the identified issue';

  const codeFix = issue.suggested_code || 'N/A';

  return {
    emoji,
    severity,
    type,
    title,
    location: `${fileName}:${lineNumbers}`,
    component,
    impact,
    solution,
    codeFix,
  };
};

export const formatCommentAsFormula = (comment: FormulaComment): string => {
  return FORMULA_TEMPLATE
    .replace('{severity}', comment.severity)
    .replace('{type}', comment.type)
    .replace('{title}', comment.title)
    .replace('{location}', comment.location)
    .replace('{component}', comment.component)
    .replace('{impact}', comment.impact)
    .replace('{solution}', comment.solution)
    .replace('{code_snippet}', comment.codeFix);
};

export const formatCommentAsMiniFormula = (comment: FormulaComment): string => {
  return MINI_FORMULA_TEMPLATE
    .replace('{severity}', comment.severity)
    .replace('{type}', comment.type)
    .replace('{title}', comment.title)
    .replace('{file}', extractFileName(comment.location))
    .replace('{line}', extractLineNumber(comment.location))
    .replace('{impact}', comment.impact.substring(0, 60))
    .replace('{solution}', comment.solution);
};

export const batchFormatComments = (
  issues: any[],
  useMiniFormat: boolean = false
): FormulaComment[] => {
  return issues.map(issue => {
    const comment = formatFormulaComment(issue);
    return {
      ...comment,
      formatted: useMiniFormat ? formatCommentAsMiniFormula(comment) : formatCommentAsFormula(comment),
    };
  });
};

export const optimizeCommentForLength = (comment: FormulaComment): FormulaComment => {
  const maxTitleLength = 60;
  const maxImpactLength = 100;
  const maxSolutionLength = 80;

  return {
    ...comment,
    title: truncateText(comment.title, maxTitleLength),
    impact: truncateText(comment.impact, maxImpactLength),
    solution: truncateText(comment.solution, maxSolutionLength),
  };
};

export const extractComponentName = (filePath: string): string => {
  const parts = filePath.split('/');
  const fileName = parts[parts.length - 1];
  const componentName = fileName.replace(/\.(ts|tsx|js|jsx)$/, '');
  
  if (componentName.includes('.')) {
    return componentName.split('.')[0];
  }
  
  return componentName;
};

export const extractFileName = (location: string): string => {
  return location.split(':')[0] || 'unknown';
};

export const extractLineNumber = (location: string): string => {
  return location.split(':')[1] || 'unknown';
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

export const categorizeCommentsByType = (comments: FormulaComment[]): Record<string, FormulaComment[]> => {
  return comments.reduce((acc, comment) => {
    const type = comment.type.toLowerCase();
    if (!acc[type]) acc[type] = [];
    acc[type].push(comment);
    return acc;
  }, {} as Record<string, FormulaComment[]>);
};

export const sortCommentsBySeverity = (comments: FormulaComment[]): FormulaComment[] => {
  const severityOrder = { 'HIGH': 0, 'MEDIUM': 1, 'LOW': 2 };
  return [...comments].sort((a, b) => {
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
};

export const generateCommentSummary = (comments: FormulaComment[]): string => {
  const byType = categorizeCommentsByType(comments);
  const total = comments.length;
  const high = comments.filter(c => c.severity === 'HIGH').length;
  const types = Object.keys(byType).length;

  return `📊 Found ${total} issues across ${types} categories (${high} high priority)`;
};