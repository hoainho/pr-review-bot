export * from './types';
export * from './staticAnalyzer';
export * from './promptBuilder';
export {
  getRule,
  getAllRules,
  getRulesByCategory,
  getRulesGroupedByCategory,
  getRulesWithPatterns,
  getEnabledRules,
  getRuleCount,
} from './rules';

import type {
  TypeScriptAnalysisResult,
  TypeScriptBestPracticesConfig,
  RuleCategory,
} from './types';
import { DEFAULT_CONFIG } from './types';
import {
  analyzeDiff as staticAnalyzeDiff,
  getDetectionStats,
  limitDetectionsPerCategory,
  hasTypeScriptFiles,
} from './staticAnalyzer';
import {
  convertToTypeScriptIssues,
  generateTypeScriptPromptSection as buildPromptSection,
} from './promptBuilder';

export async function analyzeDiffForTypeScript(
  diff: string,
  config: Partial<TypeScriptBestPracticesConfig> = {}
): Promise<TypeScriptAnalysisResult> {
  const startTime = performance.now();
  const mergedConfig: TypeScriptBestPracticesConfig = { ...DEFAULT_CONFIG, ...config };

  if (!mergedConfig.enabled || !hasTypeScriptFiles(diff)) {
    return {
      staticDetections: [],
      verifiedIssues: [],
      promptTokensUsed: 0,
      analysisTimeMs: 0,
      categoryBreakdown: createEmptyCategoryBreakdown(),
      aiVerificationSkipped: true,
    };
  }

  let detections = staticAnalyzeDiff(diff, mergedConfig);

  if (mergedConfig.maxIssuesPerCategory > 0) {
    detections = limitDetectionsPerCategory(detections, mergedConfig.maxIssuesPerCategory);
  }

  const stats = getDetectionStats(detections);
  const issues = convertToTypeScriptIssues(detections, false);

  const categoryBreakdown = createEmptyCategoryBreakdown();
  
  for (const [category, count] of Object.entries(stats.byCategory)) {
    if (categoryBreakdown[category as RuleCategory]) {
      categoryBreakdown[category as RuleCategory].staticDetections = count;
    }
  }

  for (const issue of issues) {
    if (categoryBreakdown[issue.category]) {
      categoryBreakdown[issue.category].verifiedIssues++;
    }
  }

  const analysisTimeMs = performance.now() - startTime;

  return {
    staticDetections: detections,
    verifiedIssues: issues,
    promptTokensUsed: 0,
    analysisTimeMs,
    categoryBreakdown,
    aiVerificationSkipped: mergedConfig.skipAIVerification,
  };
}

function createEmptyCategoryBreakdown(): Record<RuleCategory, { staticDetections: number; verifiedIssues: number }> {
  return {
    'type-safety': { staticDetections: 0, verifiedIssues: 0 },
    'null-safety': { staticDetections: 0, verifiedIssues: 0 },
    'generics': { staticDetections: 0, verifiedIssues: 0 },
    'enums': { staticDetections: 0, verifiedIssues: 0 },
    'strict-mode': { staticDetections: 0, verifiedIssues: 0 },
    'imports': { staticDetections: 0, verifiedIssues: 0 },
    'patterns': { staticDetections: 0, verifiedIssues: 0 },
  };
}

export { buildPromptSection as generateTypeScriptPromptSection };
export { hasTypeScriptFiles };
