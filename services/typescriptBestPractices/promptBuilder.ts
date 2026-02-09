import type {
  StaticDetectionResult,
  TypeScriptIssue,
  RuleCategory,
  DetectionConfidence,
} from './types';
import { CATEGORY_DESCRIPTIONS, SEVERITY_ORDER } from './types';
import { getRule, getAllRules } from './rules';

let issueIdCounter = 0;

function generateIssueId(): string {
  return `ts-${Date.now()}-${++issueIdCounter}`;
}

export function convertToTypeScriptIssues(
  detections: StaticDetectionResult[],
  aiVerified: boolean = false
): TypeScriptIssue[] {
  const issues: TypeScriptIssue[] = [];
  
  for (const detection of detections) {
    const rule = getRule(detection.ruleId);
    if (!rule) continue;
    
    issues.push({
      id: generateIssueId(),
      ruleId: rule.id,
      ruleName: rule.name,
      category: rule.category,
      severity: rule.severity,
      fileName: detection.fileName,
      lineNumbers: String(detection.lineNumber),
      snippet: detection.matchedCode,
      description: rule.description,
      impact: rule.impact,
      suggestedFix: rule.bestPractice?.explanation || 'See best practice example',
      suggestedCode: rule.bestPractice?.code || '',
      confidence: detection.confidence,
      aiVerified,
      references: rule.references,
    });
  }
  
  return issues.sort((a, b) => {
    const severityDiff = SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
    if (severityDiff !== 0) return severityDiff;
    return a.fileName.localeCompare(b.fileName);
  });
}

export function generateTypeScriptPromptSection(
  detections: StaticDetectionResult[]
): string {
  if (detections.length === 0) {
    return '';
  }
  
  const grouped = new Map<RuleCategory, StaticDetectionResult[]>();
  
  for (const detection of detections) {
    const rule = getRule(detection.ruleId);
    if (!rule) continue;
    
    if (!grouped.has(rule.category)) {
      grouped.set(rule.category, []);
    }
    grouped.get(rule.category)!.push(detection);
  }
  
  let prompt = `\n\n🔷 TYPESCRIPT BEST PRACTICES ANALYSIS\n`;
  prompt += `Static analysis detected ${detections.length} potential TypeScript issues.\n\n`;
  
  for (const [category, categoryDetections] of grouped) {
    const categoryDesc = CATEGORY_DESCRIPTIONS[category];
    prompt += `### ${category.toUpperCase()} (${categoryDetections.length} issues)\n`;
    prompt += `${categoryDesc}\n\n`;
    
    for (const detection of categoryDetections.slice(0, 5)) {
      const rule = getRule(detection.ruleId);
      if (!rule) continue;
      
      prompt += `- **${rule.name}** at \`${detection.fileName}:${detection.lineNumber}\`\n`;
      prompt += `  Code: \`${detection.matchedCode}\`\n`;
      prompt += `  Impact: ${rule.impact}\n`;
      
      if (rule.bestPractice) {
        prompt += `  Fix: ${rule.bestPractice.explanation}\n`;
      }
      prompt += '\n';
    }
    
    if (categoryDetections.length > 5) {
      prompt += `  ... and ${categoryDetections.length - 5} more in this category\n\n`;
    }
  }
  
  prompt += `\nPlease verify these detections and include confirmed issues in your analysis.\n`;
  prompt += `For each TypeScript issue, use bug_type: "TS_TYPE_SAFETY", "TS_NULL_SAFETY", "TS_GENERICS", "TS_ENUM", "TS_IMPORTS", or "TS_PATTERNS".\n`;
  
  return prompt;
}

export function generateCompactPrompt(): string {
  const rules = getAllRules().filter(r => r.enabledByDefault !== false);
  
  let prompt = `\n\n## TypeScript Best Practices Check\n`;
  prompt += `Review the TypeScript code for these issues:\n\n`;
  
  const categories = new Set(rules.map(r => r.category));
  
  for (const category of categories) {
    const categoryRules = rules.filter(r => r.category === category);
    prompt += `**${category}**:\n`;
    
    for (const rule of categoryRules.slice(0, 3)) {
      prompt += `- ${rule.name}: ${rule.description}\n`;
    }
    prompt += '\n';
  }
  
  return prompt;
}

export function getRuleSummary(): string {
  const rules = getAllRules();
  const byCategory = new Map<RuleCategory, number>();
  
  for (const rule of rules) {
    byCategory.set(rule.category, (byCategory.get(rule.category) || 0) + 1);
  }
  
  let summary = `TypeScript Best Practices: ${rules.length} rules across ${byCategory.size} categories\n`;
  
  for (const [category, count] of byCategory) {
    summary += `- ${category}: ${count} rules\n`;
  }
  
  return summary;
}
