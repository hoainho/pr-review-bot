import type { ReactRule, RuleCategory, RulesByCategory } from '../types';
import { WATERFALLS_RULES } from './waterfalls';
import { BUNDLE_SIZE_RULES } from './bundleSize';
import { SERVER_SIDE_RULES } from './serverSide';
import { CLIENT_SIDE_RULES } from './clientSide';
import { RERENDER_RULES } from './rerenders';
import { RENDERING_RULES } from './rendering';
import { JAVASCRIPT_RULES } from './javascript';
import { ADVANCED_RULES } from './advanced';

const RULE_REGISTRY: Map<string, ReactRule> = new Map();

function registerRules(rules: ReactRule[]): void {
  for (const rule of rules) {
    if (RULE_REGISTRY.has(rule.id)) {
      console.warn(`[ReactBestPractices] Duplicate rule ID: ${rule.id}`);
    }
    RULE_REGISTRY.set(rule.id, rule);
  }
}

registerRules(WATERFALLS_RULES);
registerRules(BUNDLE_SIZE_RULES);
registerRules(SERVER_SIDE_RULES);
registerRules(CLIENT_SIDE_RULES);
registerRules(RERENDER_RULES);
registerRules(RENDERING_RULES);
registerRules(JAVASCRIPT_RULES);
registerRules(ADVANCED_RULES);

export function getRule(id: string): ReactRule | undefined {
  return RULE_REGISTRY.get(id);
}

export function getAllRules(): ReactRule[] {
  return Array.from(RULE_REGISTRY.values());
}

export function getRulesByCategory(category: RuleCategory): ReactRule[] {
  return getAllRules().filter(rule => rule.category === category);
}

export function getRulesGroupedByCategory(): RulesByCategory {
  const grouped: Partial<RulesByCategory> = {};
  
  for (const rule of getAllRules()) {
    if (!grouped[rule.category]) {
      grouped[rule.category] = [];
    }
    grouped[rule.category]!.push(rule);
  }
  
  return grouped as RulesByCategory;
}

export function getRulesWithPatterns(): ReactRule[] {
  return getAllRules().filter(rule => rule.patterns && rule.patterns.length > 0);
}

export function getRuleCount(): number {
  return RULE_REGISTRY.size;
}

export {
  WATERFALLS_RULES,
  BUNDLE_SIZE_RULES,
  SERVER_SIDE_RULES,
  CLIENT_SIDE_RULES,
  RERENDER_RULES,
  RENDERING_RULES,
  JAVASCRIPT_RULES,
  ADVANCED_RULES,
};
