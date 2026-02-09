import type {
  StaticDetectionResult,
  ReactRule,
  RuleCategory,
  ReactIssue,
  ReactAnalysisResult,
  ReactBestPracticesConfig,
  RulePromptTemplate,
} from './types';
import { DEFAULT_CONFIG, CATEGORY_PRIORITY, CATEGORY_IMPACT } from './types';
import { getRule, getAllRules, getRulesByCategory } from './rules';
import { groupDetectionsByCategory, sortDetectionsByPriority, getDetectionStats } from './staticAnalyzer';

const MAX_PROMPT_TOKENS = 2000;
const TOKENS_PER_CHAR = 0.25;

function estimateTokens(text: string): number {
  return Math.ceil(text.length * TOKENS_PER_CHAR);
}

function buildRulePrompt(rule: ReactRule, compact = true): string {
  if (compact) {
    return `[${rule.id}] ${rule.name}
Issue: ${rule.description}
Impact: ${rule.impact}
${rule.antiPattern ? `BAD: ${rule.antiPattern.code.split('\n')[0]}...` : ''}
${rule.bestPractice ? `GOOD: ${rule.bestPractice.code.split('\n')[0]}...` : ''}`;
  }
  
  let prompt = `### Rule: ${rule.id}
**${rule.name}** (${rule.severity})

**Problem:** ${rule.description}
**Impact:** ${rule.impact}
`;

  if (rule.antiPattern) {
    prompt += `
**Anti-pattern:**
\`\`\`
${rule.antiPattern.code}
\`\`\`
${rule.antiPattern.explanation}
`;
  }

  if (rule.bestPractice) {
    prompt += `
**Best Practice:**
\`\`\`
${rule.bestPractice.code}
\`\`\`
${rule.bestPractice.explanation}
`;
  }

  if (rule.aiPromptContext) {
    prompt += `\n**Note:** ${rule.aiPromptContext}\n`;
  }

  return prompt;
}

function buildDetectionContext(detection: StaticDetectionResult, rule: ReactRule): string {
  return `[${detection.fileName}:${detection.lineNumber}] Rule: ${rule.id}
Matched: ${detection.matchedCode}
Context:
${detection.contextLines}`;
}

export function buildTargetedPrompt(
  detections: StaticDetectionResult[],
  config: ReactBestPracticesConfig = DEFAULT_CONFIG
): string {
  if (detections.length === 0) {
    return '';
  }

  const sorted = sortDetectionsByPriority(detections);
  const grouped = groupDetectionsByCategory(sorted);
  
  const triggeredRuleIds = new Set(detections.map(d => d.ruleId));
  const triggeredRules = Array.from(triggeredRuleIds)
    .map(id => getRule(id))
    .filter((r): r is ReactRule => r !== undefined);

  let prompt = `=== REACT BEST PRACTICES ANALYSIS ===

The following potential issues were detected by static analysis.
Verify each detection and provide actionable feedback.

`;

  let currentTokens = estimateTokens(prompt);
  const includedCategories = new Set<RuleCategory>();

  for (const category of Object.keys(CATEGORY_PRIORITY) as RuleCategory[]) {
    const categoryDetections = grouped[category];
    if (!categoryDetections || categoryDetections.length === 0) continue;

    const categoryHeader = `\n## ${category.toUpperCase()} (${CATEGORY_IMPACT[category]} Impact)\n`;
    const categoryTokens = estimateTokens(categoryHeader);
    
    if (currentTokens + categoryTokens > MAX_PROMPT_TOKENS) break;
    
    prompt += categoryHeader;
    currentTokens += categoryTokens;
    includedCategories.add(category);

    const categoryRules = triggeredRules.filter(r => r.category === category);
    
    for (const rule of categoryRules) {
      const rulePrompt = buildRulePrompt(rule, true);
      const ruleTokens = estimateTokens(rulePrompt);
      
      if (currentTokens + ruleTokens > MAX_PROMPT_TOKENS) break;
      
      prompt += `\n${rulePrompt}\n`;
      currentTokens += ruleTokens;

      const ruleDetections = categoryDetections
        .filter(d => d.ruleId === rule.id)
        .slice(0, config.maxIssuesPerCategory || 3);

      for (const detection of ruleDetections) {
        const detectionContext = buildDetectionContext(detection, rule);
        const detectionTokens = estimateTokens(detectionContext);
        
        if (currentTokens + detectionTokens > MAX_PROMPT_TOKENS) break;
        
        prompt += `\nDetected at:\n${detectionContext}\n`;
        currentTokens += detectionTokens;
      }
    }
  }

  prompt += `
=== VERIFICATION INSTRUCTIONS ===

For each detection:
1. Verify if the issue is genuine (not a false positive)
2. Check the surrounding context for justification
3. Provide specific fix with code example
4. Rate confidence: HIGH (definite issue), MEDIUM (likely issue), LOW (possible issue)

Output JSON format for each verified issue.
`;

  return prompt;
}

export function generateReactPromptSection(
  result: ReactAnalysisResult
): string {
  if (result.staticDetections.length === 0) {
    return '';
  }

  const stats = getDetectionStats(result.staticDetections);
  
  let section = `\n=== REACT BEST PRACTICES ANALYSIS ===

Static Analysis Results:
- Total detections: ${stats.total}
- Unique files: ${stats.uniqueFiles}
- Rules triggered: ${stats.uniqueRules}
`;

  const categoryEntries = Object.entries(stats.byCategory)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => CATEGORY_PRIORITY[a[0] as RuleCategory] - CATEGORY_PRIORITY[b[0] as RuleCategory]);

  if (categoryEntries.length > 0) {
    section += '\nBy Category:\n';
    for (const [category, count] of categoryEntries) {
      const impact = CATEGORY_IMPACT[category as RuleCategory];
      section += `  - ${category}: ${count} (${impact} impact)\n`;
    }
  }

  section += '\nDetailed Findings:\n';
  
  const sorted = sortDetectionsByPriority(result.staticDetections);
  const displayedDetections = sorted.slice(0, 15);

  for (const detection of displayedDetections) {
    const rule = getRule(detection.ruleId);
    if (!rule) continue;

    section += `\n[${rule.severity}] ${rule.name}
  File: ${detection.fileName}:${detection.lineNumber}
  Issue: ${rule.description}
  Matched: ${detection.matchedCode.slice(0, 100)}${detection.matchedCode.length > 100 ? '...' : ''}
  Confidence: ${detection.confidence}
`;
  }

  if (sorted.length > 15) {
    section += `\n... and ${sorted.length - 15} more detections\n`;
  }

  section += `
REVIEW INSTRUCTION: Verify each detection above. For genuine issues, provide:
1. Specific impact explanation
2. Corrected code example
3. Why the fix improves performance/maintainability
`;

  return section;
}

export function buildVerificationPrompt(
  detections: StaticDetectionResult[],
  fullDiff: string
): string {
  const stats = getDetectionStats(detections);
  
  return `You are verifying React best practice detections from static analysis.

STATIC ANALYSIS FOUND ${stats.total} POTENTIAL ISSUES:
${detections.map(d => {
  const rule = getRule(d.ruleId);
  return `- ${d.fileName}:${d.lineNumber} - ${rule?.name || d.ruleId}`;
}).join('\n')}

For each detection, determine:
1. Is this a true positive? (Check context, could be intentional)
2. What is the actual impact?
3. What is the specific fix?

OUTPUT FORMAT (JSON array):
[
  {
    "ruleId": "string",
    "fileName": "string", 
    "lineNumbers": "string",
    "isValid": boolean,
    "reason": "string (why valid or why false positive)",
    "suggestedFix": "string",
    "suggestedCode": "string (corrected code)",
    "severity": "CRITICAL|HIGH|MEDIUM|LOW",
    "confidence": "HIGH|MEDIUM|LOW"
  }
]

Only include issues where isValid is true.
`;
}

export function convertToReactIssues(
  detections: StaticDetectionResult[],
  aiVerified: boolean = false
): ReactIssue[] {
  return detections.map((detection, index) => {
    const rule = getRule(detection.ruleId);
    if (!rule) {
      return null;
    }

    return {
      id: `react-${detection.ruleId}-${index}`,
      ruleId: rule.id,
      ruleName: rule.name,
      category: rule.category,
      severity: rule.severity,
      fileName: detection.fileName,
      lineNumbers: String(detection.lineNumber),
      snippet: detection.contextLines,
      description: rule.description,
      impact: rule.impact,
      suggestedFix: rule.bestPractice?.explanation || 'See rule documentation',
      suggestedCode: rule.bestPractice?.code || '',
      confidence: detection.confidence,
      aiVerified,
      references: rule.references,
    };
  }).filter((issue): issue is NonNullable<typeof issue> => issue !== null) as ReactIssue[];
}

export function getRulePromptTemplates(): Map<string, RulePromptTemplate> {
  const templates = new Map<string, RulePromptTemplate>();
  
  for (const rule of getAllRules()) {
    const compactPrompt = buildRulePrompt(rule, true);
    const fullPrompt = buildRulePrompt(rule, false);
    
    templates.set(rule.id, {
      ruleId: rule.id,
      compactPrompt,
      fullPrompt,
      estimatedTokens: estimateTokens(compactPrompt),
    });
  }
  
  return templates;
}

export function selectRulesForPrompt(
  detections: StaticDetectionResult[],
  maxTokens: number = MAX_PROMPT_TOKENS
): ReactRule[] {
  const triggeredRuleIds = new Set(detections.map(d => d.ruleId));
  const rules: ReactRule[] = [];
  let currentTokens = 0;
  
  const sortedRuleIds = Array.from(triggeredRuleIds).sort((a, b) => {
    const ruleA = getRule(a);
    const ruleB = getRule(b);
    if (!ruleA || !ruleB) return 0;
    return CATEGORY_PRIORITY[ruleA.category] - CATEGORY_PRIORITY[ruleB.category];
  });
  
  for (const ruleId of sortedRuleIds) {
    const rule = getRule(ruleId);
    if (!rule) continue;
    
    const rulePrompt = buildRulePrompt(rule, true);
    const ruleTokens = estimateTokens(rulePrompt);
    
    if (currentTokens + ruleTokens > maxTokens) break;
    
    rules.push(rule);
    currentTokens += ruleTokens;
  }
  
  return rules;
}
