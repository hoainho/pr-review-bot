export type RuleCategory =
  | 'type-safety'
  | 'null-safety'
  | 'generics'
  | 'enums'
  | 'strict-mode'
  | 'imports'
  | 'patterns';

export const CATEGORY_PRIORITY: Record<RuleCategory, number> = {
  'type-safety': 1,
  'null-safety': 2,
  'generics': 3,
  'enums': 4,
  'strict-mode': 5,
  'imports': 6,
  'patterns': 7,
};

export const CATEGORY_IMPACT: Record<RuleCategory, 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'> = {
  'type-safety': 'CRITICAL',
  'null-safety': 'CRITICAL',
  'generics': 'HIGH',
  'enums': 'HIGH',
  'strict-mode': 'MEDIUM',
  'imports': 'MEDIUM',
  'patterns': 'LOW',
};

export const CATEGORY_DESCRIPTIONS: Record<RuleCategory, string> = {
  'type-safety': 'Prevents runtime errors from type mismatches and unsafe type operations',
  'null-safety': 'Prevents null/undefined reference errors at runtime',
  'generics': 'Ensures proper type inference and generic constraints',
  'enums': 'Optimizes enum usage for bundle size and type safety',
  'strict-mode': 'Enforces TypeScript strict compiler options compliance',
  'imports': 'Optimizes import statements for tree-shaking and compile time',
  'patterns': 'Encourages type-safe patterns like discriminated unions',
};

export type RuleSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export const SEVERITY_ORDER: Record<RuleSeverity, number> = {
  'CRITICAL': 4,
  'HIGH': 3,
  'MEDIUM': 2,
  'LOW': 1,
};

export type DetectionConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface TypeScriptRule {
  id: string;
  category: RuleCategory;
  severity: RuleSeverity;
  name: string;
  description: string;
  impact: string;
  patterns?: RegExp[];
  staticConfidence?: DetectionConfidence;
  antiPattern?: {
    code: string;
    explanation: string;
  };
  bestPractice?: {
    code: string;
    explanation: string;
  };
  aiPromptContext?: string;
  references?: string[];
  filePatterns?: string[];
  enabledByDefault?: boolean;
}

export interface StaticDetectionResult {
  ruleId: string;
  fileName: string;
  lineNumber: number;
  matchedCode: string;
  contextLines: string;
  confidence: DetectionConfidence;
  metadata?: Record<string, unknown>;
}

export interface TypeScriptIssue {
  id: string;
  ruleId: string;
  ruleName: string;
  category: RuleCategory;
  severity: RuleSeverity;
  fileName: string;
  lineNumbers: string;
  snippet: string;
  description: string;
  impact: string;
  suggestedFix: string;
  suggestedCode: string;
  confidence: DetectionConfidence;
  aiVerified: boolean;
  references?: string[];
}

export interface TypeScriptAnalysisResult {
  staticDetections: StaticDetectionResult[];
  verifiedIssues: TypeScriptIssue[];
  promptTokensUsed: number;
  analysisTimeMs: number;
  categoryBreakdown: Record<RuleCategory, {
    staticDetections: number;
    verifiedIssues: number;
  }>;
  aiVerificationSkipped: boolean;
}

export interface TypeScriptBestPracticesConfig {
  enabled: boolean;
  enabledCategories: RuleCategory[];
  severityThreshold: RuleSeverity;
  maxIssuesPerCategory: number;
  skipAIVerification: boolean;
  disabledRules: string[];
  excludePatterns: string[];
}

export const DEFAULT_CONFIG: TypeScriptBestPracticesConfig = {
  enabled: true,
  enabledCategories: [
    'type-safety',
    'null-safety',
    'generics',
    'enums',
    'strict-mode',
    'imports',
    'patterns',
  ],
  severityThreshold: 'LOW',
  maxIssuesPerCategory: 10,
  skipAIVerification: false,
  disabledRules: [],
  excludePatterns: [
    '**/node_modules/**',
    '**/*.test.*',
    '**/*.spec.*',
    '**/__tests__/**',
    '**/__mocks__/**',
    '**/*.d.ts',
  ],
};

export function isValidCategory(value: string): value is RuleCategory {
  return [
    'type-safety',
    'null-safety',
    'generics',
    'enums',
    'strict-mode',
    'imports',
    'patterns',
  ].includes(value);
}

export function isValidSeverity(value: string): value is RuleSeverity {
  return ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(value);
}

export function compareSeverity(a: RuleSeverity, b: RuleSeverity): number {
  return SEVERITY_ORDER[b] - SEVERITY_ORDER[a];
}

export function compareCategory(a: RuleCategory, b: RuleCategory): number {
  return CATEGORY_PRIORITY[a] - CATEGORY_PRIORITY[b];
}

export function meetsThreshold(severity: RuleSeverity, threshold: RuleSeverity): boolean {
  return SEVERITY_ORDER[severity] >= SEVERITY_ORDER[threshold];
}
