/**
 * React Best Practices Skill - Type Definitions
 * 
 * Based on Vercel Engineering's React Best Practices (57 rules, 8 categories)
 * @see https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices
 */

// =============================================================================
// RULE CATEGORIES (Prioritized by Impact)
// =============================================================================

export type RuleCategory =
  | 'waterfalls'      // Priority 1: CRITICAL - Eliminating request waterfalls
  | 'bundle-size'     // Priority 2: CRITICAL - Bundle size optimization
  | 'server-side'     // Priority 3: HIGH - Server-side performance
  | 'client-side'     // Priority 4: MEDIUM-HIGH - Client-side data fetching
  | 'rerenders'       // Priority 5: MEDIUM - Re-render optimization
  | 'rendering'       // Priority 6: MEDIUM - Rendering performance
  | 'javascript'      // Priority 7: LOW-MEDIUM - JavaScript performance
  | 'advanced';       // Priority 8: LOW - Advanced patterns

export const CATEGORY_PRIORITY: Record<RuleCategory, number> = {
  'waterfalls': 1,
  'bundle-size': 2,
  'server-side': 3,
  'client-side': 4,
  'rerenders': 5,
  'rendering': 6,
  'javascript': 7,
  'advanced': 8,
};

export const CATEGORY_IMPACT: Record<RuleCategory, 'CRITICAL' | 'HIGH' | 'MEDIUM-HIGH' | 'MEDIUM' | 'LOW-MEDIUM' | 'LOW'> = {
  'waterfalls': 'CRITICAL',
  'bundle-size': 'CRITICAL',
  'server-side': 'HIGH',
  'client-side': 'MEDIUM-HIGH',
  'rerenders': 'MEDIUM',
  'rendering': 'MEDIUM',
  'javascript': 'LOW-MEDIUM',
  'advanced': 'LOW',
};

// =============================================================================
// SEVERITY LEVELS
// =============================================================================

export type RuleSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export const SEVERITY_ORDER: Record<RuleSeverity, number> = {
  'CRITICAL': 4,
  'HIGH': 3,
  'MEDIUM': 2,
  'LOW': 1,
};

// =============================================================================
// DETECTION CONFIDENCE
// =============================================================================

export type DetectionConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

// HIGH: Static pattern match with high certainty (e.g., barrel imports)
// MEDIUM: Static pattern match that may need context (e.g., sequential awaits)
// LOW: Heuristic match, needs AI verification (e.g., missing Suspense)

// =============================================================================
// RULE DEFINITION
// =============================================================================

export interface ReactRule {
  /** Unique rule identifier, e.g., 'async-parallel' */
  id: string;
  
  /** Rule category for grouping and prioritization */
  category: RuleCategory;
  
  /** Severity when rule is violated */
  severity: RuleSeverity;
  
  /** Human-readable rule name */
  name: string;
  
  /** Brief description of what the rule checks */
  description: string;
  
  /** Explanation of why this matters (performance impact) */
  impact: string;
  
  /** 
   * Static detection pattern (optional)
   * If provided, used for Phase 1 static analysis
   */
  patterns?: RegExp[];
  
  /**
   * Confidence level of static detection
   * Rules without patterns default to 'LOW' (AI-only)
   */
  staticConfidence?: DetectionConfidence;
  
  /** Example of anti-pattern (incorrect code) */
  antiPattern?: {
    code: string;
    explanation: string;
  };
  
  /** Example of best practice (correct code) */
  bestPractice?: {
    code: string;
    explanation: string;
  };
  
  /** Additional context to include in AI prompt */
  aiPromptContext?: string;
  
  /** Documentation references */
  references?: string[];
  
  /** File patterns where this rule applies (e.g., ['*.tsx', '*.jsx']) */
  filePatterns?: string[];
  
  /** Whether this rule is enabled by default */
  enabledByDefault?: boolean;
}

// =============================================================================
// STATIC DETECTION RESULT (Phase 1 Output)
// =============================================================================

export interface StaticDetectionResult {
  /** Rule ID that triggered this detection */
  ruleId: string;
  
  /** File where the pattern was detected */
  fileName: string;
  
  /** Line number of the detection */
  lineNumber: number;
  
  /** The actual code that matched the pattern */
  matchedCode: string;
  
  /** Surrounding context (for AI verification) */
  contextLines: string;
  
  /** Confidence of this specific detection */
  confidence: DetectionConfidence;
  
  /** Additional metadata from pattern matching */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// VERIFIED ISSUE (Final Output)
// =============================================================================

export interface ReactIssue {
  /** Unique identifier for this issue */
  id: string;
  
  /** Rule ID that generated this issue */
  ruleId: string;
  
  /** Human-readable rule name */
  ruleName: string;
  
  /** Rule category */
  category: RuleCategory;
  
  /** Issue severity */
  severity: RuleSeverity;
  
  /** File containing the issue */
  fileName: string;
  
  /** Line numbers (can be range like "10-15") */
  lineNumbers: string;
  
  /** Code snippet showing the issue */
  snippet: string;
  
  /** Description of the problem */
  description: string;
  
  /** Impact explanation */
  impact: string;
  
  /** Suggested fix description */
  suggestedFix: string;
  
  /** Corrected code example */
  suggestedCode: string;
  
  /** Detection confidence */
  confidence: DetectionConfidence;
  
  /** Whether this was verified by AI (vs static-only) */
  aiVerified: boolean;
  
  /** Documentation references */
  references?: string[];
}

// =============================================================================
// ANALYSIS RESULT
// =============================================================================

export interface ReactAnalysisResult {
  /** Results from Phase 1 static analysis */
  staticDetections: StaticDetectionResult[];
  
  /** Final verified issues after AI verification */
  verifiedIssues: ReactIssue[];
  
  /** Number of tokens used in AI prompt */
  promptTokensUsed: number;
  
  /** Total analysis time in milliseconds */
  analysisTimeMs: number;
  
  /** Breakdown by category */
  categoryBreakdown: Record<RuleCategory, {
    staticDetections: number;
    verifiedIssues: number;
  }>;
  
  /** Whether AI verification was skipped */
  aiVerificationSkipped: boolean;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

export interface ReactBestPracticesConfig {
  /** Master toggle for React best practices analysis */
  enabled: boolean;
  
  /** Which categories to analyze */
  enabledCategories: RuleCategory[];
  
  /** Minimum severity to report */
  severityThreshold: RuleSeverity;
  
  /** Maximum issues to report per category (0 = unlimited) */
  maxIssuesPerCategory: number;
  
  /** Skip AI verification (faster, but more false positives) */
  skipAIVerification: boolean;
  
  /** Specific rules to disable (by rule ID) */
  disabledRules: string[];
  
  /** File patterns to exclude from analysis */
  excludePatterns: string[];
  
  /** Whether to detect Next.js specific patterns */
  enableNextJsRules: boolean;
  
  /** Whether to detect React Server Components patterns */
  enableRSCRules: boolean;
}

export const DEFAULT_CONFIG: ReactBestPracticesConfig = {
  enabled: true,
  enabledCategories: [
    'waterfalls',
    'bundle-size',
    'server-side',
    'client-side',
    'rerenders',
    'rendering',
    'javascript',
    'advanced',
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
  ],
  enableNextJsRules: true,
  enableRSCRules: true,
};

// =============================================================================
// RULE PROMPT TEMPLATE
// =============================================================================

export interface RulePromptTemplate {
  /** Rule ID */
  ruleId: string;
  
  /** Compact prompt for AI (token-optimized) */
  compactPrompt: string;
  
  /** Full prompt with examples (for detailed analysis) */
  fullPrompt?: string;
  
  /** Estimated token count */
  estimatedTokens: number;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export type RulesByCategory = Record<RuleCategory, ReactRule[]>;

export type DetectionsByCategory = Record<RuleCategory, StaticDetectionResult[]>;

export type IssuesByCategory = Record<RuleCategory, ReactIssue[]>;

// =============================================================================
// TYPE GUARDS
// =============================================================================

export function isValidCategory(value: string): value is RuleCategory {
  return [
    'waterfalls',
    'bundle-size',
    'server-side',
    'client-side',
    'rerenders',
    'rendering',
    'javascript',
    'advanced',
  ].includes(value);
}

export function isValidSeverity(value: string): value is RuleSeverity {
  return ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(value);
}

export function isValidConfidence(value: string): value is DetectionConfidence {
  return ['HIGH', 'MEDIUM', 'LOW'].includes(value);
}

// =============================================================================
// COMPARISON UTILITIES
// =============================================================================

export function compareSeverity(a: RuleSeverity, b: RuleSeverity): number {
  return SEVERITY_ORDER[b] - SEVERITY_ORDER[a];
}

export function compareCategory(a: RuleCategory, b: RuleCategory): number {
  return CATEGORY_PRIORITY[a] - CATEGORY_PRIORITY[b];
}

export function meetsThreshold(severity: RuleSeverity, threshold: RuleSeverity): boolean {
  return SEVERITY_ORDER[severity] >= SEVERITY_ORDER[threshold];
}
