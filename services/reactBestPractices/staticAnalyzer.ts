import type { 
  StaticDetectionResult, 
  ReactRule, 
  RuleCategory,
  ReactBestPracticesConfig,
  DetectionsByCategory 
} from './types';
import { DEFAULT_CONFIG, CATEGORY_PRIORITY, meetsThreshold } from './types';
import { getAllRules, getRulesWithPatterns } from './rules';

interface ParsedFileDiff {
  fileName: string;
  addedLines: string[];
  fullContent: string;
  lineNumberMapping: Map<number, number>;
}

function parseDiffByFiles(diff: string): ParsedFileDiff[] {
  const files: ParsedFileDiff[] = [];
  const lines = diff.split('\n');
  
  let currentFile: string | null = null;
  let addedLines: string[] = [];
  let lineMapping = new Map<number, number>();
  let addedLineIndex = 0;
  let currentLineNumber = 0;
  
  for (const line of lines) {
    const fileMatch = line.match(/^\+\+\+\s+(?:b\/)?(.+)$/);
    if (fileMatch) {
      if (currentFile && addedLines.length > 0) {
        files.push({
          fileName: currentFile,
          addedLines,
          fullContent: addedLines.join('\n'),
          lineNumberMapping: lineMapping,
        });
      }
      currentFile = fileMatch[1];
      addedLines = [];
      lineMapping = new Map();
      addedLineIndex = 0;
      currentLineNumber = 0;
      continue;
    }
    
    const hunkMatch = line.match(/^@@\s*-\d+(?:,\d+)?\s+\+(\d+)/);
    if (hunkMatch) {
      currentLineNumber = parseInt(hunkMatch[1], 10) - 1;
      continue;
    }
    
    if (currentFile) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        currentLineNumber++;
        addedLines.push(line.slice(1));
        lineMapping.set(addedLineIndex, currentLineNumber);
        addedLineIndex++;
      } else if (line.startsWith('-')) {
        continue;
      } else if (!line.startsWith('\\')) {
        currentLineNumber++;
      }
    }
  }
  
  if (currentFile && addedLines.length > 0) {
    files.push({
      fileName: currentFile,
      addedLines,
      fullContent: addedLines.join('\n'),
      lineNumberMapping: lineMapping,
    });
  }
  
  return files;
}

function isReactFile(fileName: string): boolean {
  return /\.(tsx?|jsx?)$/.test(fileName);
}

function matchesFilePattern(fileName: string, patterns?: string[]): boolean {
  if (!patterns || patterns.length === 0) return true;
  
  return patterns.some(pattern => {
    const regex = new RegExp(
      pattern
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\./g, '\\.')
    );
    return regex.test(fileName);
  });
}

function shouldExcludeFile(fileName: string, excludePatterns: string[]): boolean {
  return excludePatterns.some(pattern => {
    const regex = new RegExp(
      pattern
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\./g, '\\.')
    );
    return regex.test(fileName);
  });
}

function getContextLines(lines: string[], lineIndex: number, contextSize = 3): string {
  const start = Math.max(0, lineIndex - contextSize);
  const end = Math.min(lines.length, lineIndex + contextSize + 1);
  return lines.slice(start, end).join('\n');
}

function analyzeFileWithRule(
  file: ParsedFileDiff,
  rule: ReactRule
): StaticDetectionResult[] {
  const detections: StaticDetectionResult[] = [];
  
  if (!rule.patterns || rule.patterns.length === 0) return detections;
  if (!matchesFilePattern(file.fileName, rule.filePatterns)) return detections;
  
  const content = file.fullContent;
  const lines = file.addedLines;
  
  for (const pattern of rule.patterns) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    
    while ((match = pattern.exec(content)) !== null) {
      const matchStart = match.index;
      const linesBefore = content.slice(0, matchStart).split('\n');
      const localLineNumber = linesBefore.length - 1;
      
      const actualLineNumber = file.lineNumberMapping.get(localLineNumber) || localLineNumber + 1;
      
      detections.push({
        ruleId: rule.id,
        fileName: file.fileName,
        lineNumber: actualLineNumber,
        matchedCode: match[0].slice(0, 200),
        contextLines: getContextLines(lines, localLineNumber),
        confidence: rule.staticConfidence || 'MEDIUM',
      });
      
      if (pattern.global && match.index === pattern.lastIndex) {
        pattern.lastIndex++;
      }
    }
  }
  
  return detections;
}

export function analyzeFile(
  fileName: string,
  content: string,
  config: ReactBestPracticesConfig = DEFAULT_CONFIG
): StaticDetectionResult[] {
  if (!isReactFile(fileName)) return [];
  if (shouldExcludeFile(fileName, config.excludePatterns)) return [];
  
  const detections: StaticDetectionResult[] = [];
  const rules = getRulesWithPatterns();
  const lines = content.split('\n');
  
  for (const rule of rules) {
    if (config.disabledRules.includes(rule.id)) continue;
    if (!config.enabledCategories.includes(rule.category)) continue;
    if (!meetsThreshold(rule.severity, config.severityThreshold)) continue;
    if (!matchesFilePattern(fileName, rule.filePatterns)) continue;
    
    if (!rule.patterns) continue;
    
    for (const pattern of rule.patterns) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      
      while ((match = pattern.exec(content)) !== null) {
        const matchStart = match.index;
        const linesBefore = content.slice(0, matchStart).split('\n');
        const lineNumber = linesBefore.length;
        
        detections.push({
          ruleId: rule.id,
          fileName,
          lineNumber,
          matchedCode: match[0].slice(0, 200),
          contextLines: getContextLines(lines, lineNumber - 1),
          confidence: rule.staticConfidence || 'MEDIUM',
        });
        
        if (pattern.global && match.index === pattern.lastIndex) {
          pattern.lastIndex++;
        }
      }
    }
  }
  
  return detections;
}

export function analyzeDiff(
  diff: string,
  config: ReactBestPracticesConfig = DEFAULT_CONFIG
): StaticDetectionResult[] {
  if (!config.enabled) return [];
  
  const files = parseDiffByFiles(diff);
  const detections: StaticDetectionResult[] = [];
  const rules = getRulesWithPatterns();
  
  for (const file of files) {
    if (!isReactFile(file.fileName)) continue;
    if (shouldExcludeFile(file.fileName, config.excludePatterns)) continue;
    
    for (const rule of rules) {
      if (config.disabledRules.includes(rule.id)) continue;
      if (!config.enabledCategories.includes(rule.category)) continue;
      if (!meetsThreshold(rule.severity, config.severityThreshold)) continue;
      
      const ruleDetections = analyzeFileWithRule(file, rule);
      detections.push(...ruleDetections);
    }
  }
  
  return detections;
}

export function groupDetectionsByCategory(
  detections: StaticDetectionResult[]
): DetectionsByCategory {
  const rules = getAllRules();
  const ruleMap = new Map(rules.map(r => [r.id, r]));
  
  const grouped: Partial<DetectionsByCategory> = {};
  
  for (const detection of detections) {
    const rule = ruleMap.get(detection.ruleId);
    if (!rule) continue;
    
    if (!grouped[rule.category]) {
      grouped[rule.category] = [];
    }
    grouped[rule.category]!.push(detection);
  }
  
  return grouped as DetectionsByCategory;
}

export function sortDetectionsByPriority(
  detections: StaticDetectionResult[]
): StaticDetectionResult[] {
  const rules = getAllRules();
  const ruleMap = new Map(rules.map(r => [r.id, r]));
  
  return [...detections].sort((a, b) => {
    const ruleA = ruleMap.get(a.ruleId);
    const ruleB = ruleMap.get(b.ruleId);
    
    if (!ruleA || !ruleB) return 0;
    
    const categoryDiff = CATEGORY_PRIORITY[ruleA.category] - CATEGORY_PRIORITY[ruleB.category];
    if (categoryDiff !== 0) return categoryDiff;
    
    const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return severityOrder[ruleA.severity] - severityOrder[ruleB.severity];
  });
}

export function limitDetectionsPerCategory(
  detections: StaticDetectionResult[],
  maxPerCategory: number
): StaticDetectionResult[] {
  if (maxPerCategory <= 0) return detections;
  
  const grouped = groupDetectionsByCategory(detections);
  const limited: StaticDetectionResult[] = [];
  
  for (const category of Object.keys(grouped) as RuleCategory[]) {
    const categoryDetections = grouped[category] || [];
    limited.push(...categoryDetections.slice(0, maxPerCategory));
  }
  
  return sortDetectionsByPriority(limited);
}

export function getDetectionStats(detections: StaticDetectionResult[]): {
  total: number;
  byCategory: Record<RuleCategory, number>;
  byConfidence: Record<string, number>;
  uniqueFiles: number;
  uniqueRules: number;
} {
  const rules = getAllRules();
  const ruleMap = new Map(rules.map(r => [r.id, r]));
  
  const byCategory: Partial<Record<RuleCategory, number>> = {};
  const byConfidence: Record<string, number> = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  const files = new Set<string>();
  const ruleIds = new Set<string>();
  
  for (const detection of detections) {
    const rule = ruleMap.get(detection.ruleId);
    if (rule) {
      byCategory[rule.category] = (byCategory[rule.category] || 0) + 1;
    }
    
    byConfidence[detection.confidence]++;
    files.add(detection.fileName);
    ruleIds.add(detection.ruleId);
  }
  
  return {
    total: detections.length,
    byCategory: byCategory as Record<RuleCategory, number>,
    byConfidence,
    uniqueFiles: files.size,
    uniqueRules: ruleIds.size,
  };
}
