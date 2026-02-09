export * from './types';
export * from './staticAnalyzer';
export * from './promptBuilder';
export { 
  getRule, 
  getAllRules, 
  getRulesByCategory, 
  getRulesGroupedByCategory,
  getRulesWithPatterns,
  getRuleCount 
} from './rules';

import type { 
  ReactAnalysisResult, 
  ReactBestPracticesConfig,
  RuleCategory 
} from './types';
import { DEFAULT_CONFIG } from './types';
import { 
  analyzeDiff as staticAnalyzeDiff, 
  getDetectionStats,
  limitDetectionsPerCategory 
} from './staticAnalyzer';
import { 
  convertToReactIssues, 
  generateReactPromptSection as buildPromptSection 
} from './promptBuilder';

export async function analyzeDiffForReact(
  diff: string,
  config: Partial<ReactBestPracticesConfig> = {}
): Promise<ReactAnalysisResult> {
  const startTime = performance.now();
  const mergedConfig: ReactBestPracticesConfig = { ...DEFAULT_CONFIG, ...config };
  
  if (!mergedConfig.enabled) {
    return {
      staticDetections: [],
      verifiedIssues: [],
      promptTokensUsed: 0,
      analysisTimeMs: 0,
      categoryBreakdown: {} as Record<RuleCategory, { staticDetections: number; verifiedIssues: number }>,
      aiVerificationSkipped: true,
    };
  }
  
  let detections = staticAnalyzeDiff(diff, mergedConfig);
  
  if (mergedConfig.maxIssuesPerCategory > 0) {
    detections = limitDetectionsPerCategory(detections, mergedConfig.maxIssuesPerCategory);
  }
  
  const stats = getDetectionStats(detections);
  
  const issues = convertToReactIssues(detections, false);
  
  const categoryBreakdown: Record<RuleCategory, { staticDetections: number; verifiedIssues: number }> = {
    'waterfalls': { staticDetections: 0, verifiedIssues: 0 },
    'bundle-size': { staticDetections: 0, verifiedIssues: 0 },
    'server-side': { staticDetections: 0, verifiedIssues: 0 },
    'client-side': { staticDetections: 0, verifiedIssues: 0 },
    'rerenders': { staticDetections: 0, verifiedIssues: 0 },
    'rendering': { staticDetections: 0, verifiedIssues: 0 },
    'javascript': { staticDetections: 0, verifiedIssues: 0 },
    'advanced': { staticDetections: 0, verifiedIssues: 0 },
  };
  
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

export { buildPromptSection as generateReactPromptSection };
