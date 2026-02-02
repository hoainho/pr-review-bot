import { ReviewPresetType, Severity, BugType } from '../types';
import type { ReviewPreset, ReviewRule, TeamConfig } from '../types';

const STORAGE_KEY = 'gear-pr-review-presets';
const TEAM_CONFIG_KEY = 'gear-pr-review-team-config';

export const DEFAULT_RULES: ReviewRule[] = [
  { id: 'security-sql-injection', name: 'SQL Injection Detection', category: 'security', enabled: true, severity: 'HIGH' as Severity },
  { id: 'security-xss', name: 'XSS Vulnerability Detection', category: 'security', enabled: true, severity: 'HIGH' as Severity },
  { id: 'security-auth-bypass', name: 'Authentication Bypass', category: 'security', enabled: true, severity: 'CRITICAL' as Severity },
  { id: 'security-secrets', name: 'Hardcoded Secrets', category: 'security', enabled: true, severity: 'CRITICAL' as Severity },
  { id: 'perf-o-n2', name: 'O(n²) Algorithm Detection', category: 'performance', enabled: true, severity: 'HIGH' as Severity },
  { id: 'perf-memory-leak', name: 'Memory Leak Detection', category: 'performance', enabled: true, severity: 'HIGH' as Severity },
  { id: 'perf-excessive-renders', name: 'Excessive Re-renders', category: 'performance', enabled: true, severity: 'MEDIUM' as Severity },
  { id: 'perf-blocking-main', name: 'Main Thread Blocking', category: 'performance', enabled: true, severity: 'MEDIUM' as Severity },
  { id: 'maintain-duplication', name: 'Code Duplication', category: 'maintainability', enabled: true, severity: 'MEDIUM' as Severity },
  { id: 'maintain-complexity', name: 'High Cyclomatic Complexity', category: 'maintainability', enabled: true, severity: 'MEDIUM' as Severity },
  { id: 'maintain-dead-code', name: 'Dead Code Detection', category: 'maintainability', enabled: false, severity: 'LOW' as Severity },
  { id: 'style-naming', name: 'Naming Conventions', category: 'style', enabled: false, severity: 'LOW' as Severity },
  { id: 'style-formatting', name: 'Code Formatting', category: 'style', enabled: false, severity: 'LOW' as Severity },
  { id: 'bp-error-handling', name: 'Error Handling', category: 'best_practices', enabled: true, severity: 'MEDIUM' as Severity },
  { id: 'bp-type-safety', name: 'Type Safety', category: 'best_practices', enabled: true, severity: 'MEDIUM' as Severity },
  { id: 'bp-async-patterns', name: 'Async/Await Patterns', category: 'best_practices', enabled: true, severity: 'LOW' as Severity },
];

export const BUILTIN_PRESETS: ReviewPreset[] = [
  {
    id: 'preset-strict',
    name: 'Strict',
    type: 'STRICT' as ReviewPresetType,
    description: 'Maximum scrutiny - catches everything including minor issues',
    rules: DEFAULT_RULES.map(r => ({ ...r, enabled: true })),
    enabled_checks: Object.values(BugType) as BugType[],
    severity_threshold: 'LOW' as Severity,
    js2026_enabled: true,
    performance_analysis: true,
  },
  {
    id: 'preset-moderate',
    name: 'Moderate',
    type: 'MODERATE' as ReviewPresetType,
    description: 'Balanced review - focus on important issues',
    rules: DEFAULT_RULES,
    enabled_checks: [
      'RACE_CONDITION', 'STATE_MANAGEMENT', 'MEMORY_LEAK', 'SECURITY', 
      'CRASH', 'CORRUPTION', 'PERFORMANCE', 'RESOURCE_LEAK', 'BREAKING_CHANGE'
    ] as BugType[],
    severity_threshold: 'MEDIUM' as Severity,
    js2026_enabled: true,
    performance_analysis: true,
  },
  {
    id: 'preset-lenient',
    name: 'Lenient',
    type: 'LENIENT' as ReviewPresetType,
    description: 'Only critical issues - fast reviews for trusted code',
    rules: DEFAULT_RULES.map(r => ({
      ...r,
      enabled: r.category === 'security' || r.severity === 'CRITICAL' as Severity
    })),
    enabled_checks: ['SECURITY', 'CRASH', 'CORRUPTION', 'MEMORY_LEAK'] as BugType[],
    severity_threshold: 'HIGH' as Severity,
    js2026_enabled: false,
    performance_analysis: false,
  },
  {
    id: 'preset-security',
    name: 'Security Focused',
    type: 'SECURITY_FOCUSED' as ReviewPresetType,
    description: 'Deep security analysis - for sensitive codebases',
    rules: DEFAULT_RULES.map(r => ({
      ...r,
      enabled: r.category === 'security',
      severity: r.category === 'security' ? 'CRITICAL' as Severity : r.severity
    })),
    enabled_checks: ['SECURITY', 'CORRUPTION', 'CRASH'] as BugType[],
    severity_threshold: 'LOW' as Severity,
    js2026_enabled: false,
    performance_analysis: false,
  },
  {
    id: 'preset-performance',
    name: 'Performance Focused',
    type: 'PERFORMANCE_FOCUSED' as ReviewPresetType,
    description: 'Optimize for speed - ideal for performance-critical apps',
    rules: DEFAULT_RULES.map(r => ({
      ...r,
      enabled: r.category === 'performance' || r.id.includes('perf'),
      severity: r.category === 'performance' ? 'HIGH' as Severity : r.severity
    })),
    enabled_checks: ['PERFORMANCE', 'MEMORY_LEAK', 'RESOURCE_LEAK', 'JS_SYNTAX_OPTIMIZATION'] as BugType[],
    severity_threshold: 'LOW' as Severity,
    js2026_enabled: true,
    performance_analysis: true,
  },
];

export const getBuiltinPresets = (): ReviewPreset[] => {
  return BUILTIN_PRESETS;
};

export const getCustomPresets = (): ReviewPreset[] => {
  if (typeof localStorage === 'undefined') return [];
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
};

export const getAllPresets = (): ReviewPreset[] => {
  return [...BUILTIN_PRESETS, ...getCustomPresets()];
};

export const getPresetById = (id: string): ReviewPreset | null => {
  return getAllPresets().find(p => p.id === id) || null;
};

export const getPresetByType = (type: ReviewPresetType): ReviewPreset | null => {
  return getAllPresets().find(p => p.type === type) || null;
};

export const saveCustomPreset = (preset: ReviewPreset): void => {
  if (typeof localStorage === 'undefined') return;
  
  const custom = getCustomPresets();
  const index = custom.findIndex(p => p.id === preset.id);
  
  if (index >= 0) {
    custom[index] = preset;
  } else {
    custom.push({ ...preset, type: 'CUSTOM' as ReviewPresetType });
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
};

export const deleteCustomPreset = (id: string): void => {
  if (typeof localStorage === 'undefined') return;
  
  const custom = getCustomPresets().filter(p => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
};

export const createPreset = (
  name: string,
  description: string,
  rules: ReviewRule[],
  options: {
    js2026_enabled?: boolean;
    performance_analysis?: boolean;
    severity_threshold?: Severity;
    enabled_checks?: BugType[];
  } = {}
): ReviewPreset => {
  return {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    type: 'CUSTOM' as ReviewPresetType,
    description,
    rules,
    enabled_checks: options.enabled_checks || Object.values(BugType) as BugType[],
    severity_threshold: options.severity_threshold || ('MEDIUM' as Severity),
    js2026_enabled: options.js2026_enabled ?? true,
    performance_analysis: options.performance_analysis ?? true,
  };
};

export const getTeamConfig = (): TeamConfig | null => {
  if (typeof localStorage === 'undefined') return null;
  const stored = localStorage.getItem(TEAM_CONFIG_KEY);
  if (!stored) return null;
  
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
};

export const saveTeamConfig = (config: TeamConfig): void => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(TEAM_CONFIG_KEY, JSON.stringify(config));
};

export const createTeamConfig = (
  name: string,
  preset: ReviewPreset,
  customRules: ReviewRule[] = [],
  ignorePatterns: string[] = [],
  fileExclusions: string[] = []
): TeamConfig => {
  return {
    id: `team-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    preset,
    custom_rules: customRules,
    ignore_patterns: ignorePatterns,
    file_exclusions: fileExclusions,
  };
};

export const mergePresetWithConfig = (
  preset: ReviewPreset,
  config: TeamConfig
): ReviewPreset => {
  const mergedRules = [...preset.rules];
  
  for (const customRule of config.custom_rules) {
    const index = mergedRules.findIndex(r => r.id === customRule.id);
    if (index >= 0) {
      mergedRules[index] = customRule;
    } else {
      mergedRules.push(customRule);
    }
  }
  
  return {
    ...preset,
    rules: mergedRules,
  };
};

export const shouldAnalyzeFile = (
  fileName: string,
  config?: TeamConfig
): boolean => {
  if (!config) return true;
  
  for (const pattern of config.file_exclusions) {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    if (regex.test(fileName)) return false;
  }
  
  return true;
};

export const shouldReportIssue = (
  severity: Severity,
  bugType: BugType,
  preset: ReviewPreset
): boolean => {
  const severityOrder = [Severity.LOW, Severity.MEDIUM, Severity.HIGH, Severity.CRITICAL];
  const thresholdIndex = severityOrder.indexOf(preset.severity_threshold);
  const issueIndex = severityOrder.indexOf(severity);
  
  if (issueIndex < thresholdIndex) return false;
  
  if (!preset.enabled_checks.includes(bugType)) return false;
  
  return true;
};
