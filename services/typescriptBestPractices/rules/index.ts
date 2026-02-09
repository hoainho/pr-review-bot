import type { TypeScriptRule, RuleCategory } from '../types';
import { typeSafetyRules } from './typeSafety';
import { nullSafetyRules } from './nullSafety';
import { genericsRules } from './generics';
import { enumRules } from './enums';
import { importRules } from './imports';
import { patternRules } from './patterns';

const ALL_RULES: TypeScriptRule[] = [
  ...typeSafetyRules,
  ...nullSafetyRules,
  ...genericsRules,
  ...enumRules,
  ...importRules,
  ...patternRules,
];

export function getRule(ruleId: string): TypeScriptRule | undefined {
  return ALL_RULES.find(r => r.id === ruleId);
}

export function getAllRules(): TypeScriptRule[] {
  return ALL_RULES;
}

export function getRulesByCategory(category: RuleCategory): TypeScriptRule[] {
  return ALL_RULES.filter(r => r.category === category);
}

export function getRulesGroupedByCategory(): Record<RuleCategory, TypeScriptRule[]> {
  const grouped: Record<RuleCategory, TypeScriptRule[]> = {
    'type-safety': [],
    'null-safety': [],
    'generics': [],
    'enums': [],
    'strict-mode': [],
    'imports': [],
    'patterns': [],
  };
  
  for (const rule of ALL_RULES) {
    grouped[rule.category].push(rule);
  }
  
  return grouped;
}

export function getRulesWithPatterns(): TypeScriptRule[] {
  return ALL_RULES.filter(r => r.patterns && r.patterns.length > 0);
}

export function getEnabledRules(disabledRuleIds: string[] = []): TypeScriptRule[] {
  return ALL_RULES.filter(r => 
    r.enabledByDefault !== false && !disabledRuleIds.includes(r.id)
  );
}

export function getRuleCount(): number {
  return ALL_RULES.length;
}

export {
  typeSafetyRules,
  nullSafetyRules,
  genericsRules,
  enumRules,
  importRules,
  patternRules,
};
