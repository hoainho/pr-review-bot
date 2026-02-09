import type {
  TypeScriptRule,
  StaticDetectionResult,
  TypeScriptBestPracticesConfig,
  RuleCategory,
  DetectionConfidence,
} from './types';
import { DEFAULT_CONFIG, CATEGORY_PRIORITY, meetsThreshold } from './types';
import { getRulesWithPatterns, getEnabledRules } from './rules';

interface ParsedFileDiff {
  fileName: string;
  addedLines: { lineNumber: number; content: string }[];
  fullContent: string;
}

function isTypeScriptFile(fileName: string): boolean {
  return /\.(ts|tsx)$/.test(fileName) && !/\.d\.ts$/.test(fileName);
}

function shouldExcludeFile(fileName: string, excludePatterns: string[]): boolean {
  for (const pattern of excludePatterns) {
    const regex = new RegExp(
      pattern
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\//g, '\\/')
    );
    if (regex.test(fileName)) {
      return true;
    }
  }
  return false;
}

function parseDiffByFiles(diff: string): ParsedFileDiff[] {
  const files: ParsedFileDiff[] = [];
  const lines = diff.split('\n');
  
  let currentFile: string | null = null;
  let currentLines: { lineNumber: number; content: string }[] = [];
  let lineNumber = 0;
  
  for (const line of lines) {
    const fileMatch = line.match(/^\+\+\+ b\/(.+)$/);
    if (fileMatch) {
      if (currentFile && currentLines.length > 0) {
        files.push({
          fileName: currentFile,
          addedLines: currentLines,
          fullContent: currentLines.map(l => l.content).join('\n'),
        });
      }
      currentFile = fileMatch[1];
      currentLines = [];
      lineNumber = 0;
      continue;
    }
    
    const hunkMatch = line.match(/^@@\s*-\d+(?:,\d+)?\s*\+(\d+)(?:,\d+)?\s*@@/);
    if (hunkMatch) {
      lineNumber = parseInt(hunkMatch[1], 10) - 1;
      continue;
    }
    
    if (line.startsWith('+') && !line.startsWith('+++')) {
      lineNumber++;
      currentLines.push({
        lineNumber,
        content: line.substring(1),
      });
    } else if (!line.startsWith('-')) {
      lineNumber++;
    }
  }
  
  if (currentFile && currentLines.length > 0) {
    files.push({
      fileName: currentFile,
      addedLines: currentLines,
      fullContent: currentLines.map(l => l.content).join('\n'),
    });
  }
  
  return files;
}

function getContextLines(
  allLines: { lineNumber: number; content: string }[],
  targetLine: number,
  contextSize: number = 2
): string {
  const startIdx = Math.max(0, allLines.findIndex(l => l.lineNumber === targetLine) - contextSize);
  const endIdx = Math.min(allLines.length, startIdx + contextSize * 2 + 1);
  
  return allLines
    .slice(startIdx, endIdx)
    .map(l => `${l.lineNumber}: ${l.content}`)
    .join('\n');
}

function runPatternMatching(
  rule: TypeScriptRule,
  file: ParsedFileDiff
): StaticDetectionResult[] {
  const results: StaticDetectionResult[] = [];
  
  if (!rule.patterns || rule.patterns.length === 0) {
    return results;
  }
  
  for (const addedLine of file.addedLines) {
    for (const pattern of rule.patterns) {
      const regex = new RegExp(pattern.source, pattern.flags.replace('g', ''));
      
      if (regex.test(addedLine.content)) {
        const match = addedLine.content.match(regex);
        
        results.push({
          ruleId: rule.id,
          fileName: file.fileName,
          lineNumber: addedLine.lineNumber,
          matchedCode: match?.[0] || addedLine.content.trim(),
          contextLines: getContextLines(file.addedLines, addedLine.lineNumber),
          confidence: rule.staticConfidence || 'MEDIUM',
        });
        
        break;
      }
    }
  }
  
  return results;
}

export function analyzeDiff(
  diff: string,
  config: Partial<TypeScriptBestPracticesConfig> = {}
): StaticDetectionResult[] {
  const mergedConfig: TypeScriptBestPracticesConfig = { ...DEFAULT_CONFIG, ...config };
  
  if (!mergedConfig.enabled) {
    return [];
  }
  
  const files = parseDiffByFiles(diff);
  const tsFiles = files.filter(f => 
    isTypeScriptFile(f.fileName) && 
    !shouldExcludeFile(f.fileName, mergedConfig.excludePatterns)
  );
  
  if (tsFiles.length === 0) {
    return [];
  }
  
  const enabledRules = getEnabledRules(mergedConfig.disabledRules)
    .filter(r => mergedConfig.enabledCategories.includes(r.category))
    .filter(r => meetsThreshold(r.severity, mergedConfig.severityThreshold));
  
  const rulesWithPatterns = enabledRules.filter(r => r.patterns && r.patterns.length > 0);
  
  const allDetections: StaticDetectionResult[] = [];
  
  for (const file of tsFiles) {
    for (const rule of rulesWithPatterns) {
      const detections = runPatternMatching(rule, file);
      allDetections.push(...detections);
    }
  }
  
  return allDetections;
}

export function getDetectionStats(detections: StaticDetectionResult[]): {
  total: number;
  byCategory: Record<RuleCategory, number>;
  byConfidence: Record<DetectionConfidence, number>;
  byFile: Record<string, number>;
} {
  const stats = {
    total: detections.length,
    byCategory: {} as Record<RuleCategory, number>,
    byConfidence: { HIGH: 0, MEDIUM: 0, LOW: 0 } as Record<DetectionConfidence, number>,
    byFile: {} as Record<string, number>,
  };
  
  const rules = getRulesWithPatterns();
  const ruleMap = new Map(rules.map(r => [r.id, r]));
  
  for (const detection of detections) {
    const rule = ruleMap.get(detection.ruleId);
    if (rule) {
      stats.byCategory[rule.category] = (stats.byCategory[rule.category] || 0) + 1;
    }
    
    stats.byConfidence[detection.confidence]++;
    stats.byFile[detection.fileName] = (stats.byFile[detection.fileName] || 0) + 1;
  }
  
  return stats;
}

export function limitDetectionsPerCategory(
  detections: StaticDetectionResult[],
  maxPerCategory: number
): StaticDetectionResult[] {
  const rules = getRulesWithPatterns();
  const ruleMap = new Map(rules.map(r => [r.id, r]));
  
  const categoryCount: Record<RuleCategory, number> = {
    'type-safety': 0,
    'null-safety': 0,
    'generics': 0,
    'enums': 0,
    'strict-mode': 0,
    'imports': 0,
    'patterns': 0,
  };
  
  const sorted = [...detections].sort((a, b) => {
    const ruleA = ruleMap.get(a.ruleId);
    const ruleB = ruleMap.get(b.ruleId);
    if (!ruleA || !ruleB) return 0;
    return CATEGORY_PRIORITY[ruleA.category] - CATEGORY_PRIORITY[ruleB.category];
  });
  
  return sorted.filter(detection => {
    const rule = ruleMap.get(detection.ruleId);
    if (!rule) return false;
    
    if (categoryCount[rule.category] >= maxPerCategory) {
      return false;
    }
    
    categoryCount[rule.category]++;
    return true;
  });
}

export function hasTypeScriptFiles(diff: string): boolean {
  const files = parseDiffByFiles(diff);
  return files.some(f => isTypeScriptFile(f.fileName));
}
