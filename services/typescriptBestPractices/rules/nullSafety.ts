import type { TypeScriptRule } from '../types';

export const nullSafetyRules: TypeScriptRule[] = [
  {
    id: 'no-non-null-assertion',
    category: 'null-safety',
    severity: 'CRITICAL',
    name: 'Avoid non-null assertion operator (!)',
    description: 'The non-null assertion operator (!) tells TypeScript to trust you, but can cause runtime errors',
    impact: 'Runtime "Cannot read property of undefined" errors',
    patterns: [
      /\w+!\./g,
      /\w+!\[/g,
      /\w+!\(/g,
      /\)\!/g,
    ],
    staticConfidence: 'HIGH',
    antiPattern: {
      code: `const name = user!.name; // Crashes if user is null`,
      explanation: '! operator bypasses null checking',
    },
    bestPractice: {
      code: `const name = user?.name ?? 'Unknown';
// Or with explicit check:
if (user) {
  const name = user.name;
}`,
      explanation: 'Use optional chaining or explicit null checks',
    },
    references: [
      'https://typescript-eslint.io/rules/no-non-null-assertion/',
    ],
    filePatterns: ['*.ts', '*.tsx'],
    enabledByDefault: true,
  },
  {
    id: 'prefer-optional-chain',
    category: 'null-safety',
    severity: 'HIGH',
    name: 'Prefer optional chaining (?.) over && chains',
    description: 'Optional chaining is more concise and handles null/undefined consistently',
    impact: 'Verbose code, potential for subtle bugs with falsy values',
    patterns: [
      /\w+\s*&&\s*\w+\.\w+/g,
      /\w+\s*&&\s*\w+\s*&&\s*\w+\.\w+/g,
    ],
    staticConfidence: 'MEDIUM',
    antiPattern: {
      code: `const city = user && user.address && user.address.city;`,
      explanation: '&& chains are verbose and can have issues with falsy values like 0 or ""',
    },
    bestPractice: {
      code: `const city = user?.address?.city;`,
      explanation: 'Optional chaining is concise and only checks for null/undefined',
    },
    references: [
      'https://typescript-eslint.io/rules/prefer-optional-chain/',
    ],
    filePatterns: ['*.ts', '*.tsx'],
    enabledByDefault: true,
  },
  {
    id: 'prefer-nullish-coalescing',
    category: 'null-safety',
    severity: 'HIGH',
    name: 'Prefer nullish coalescing (??) over logical OR (||)',
    description: '|| treats 0, "", false as falsy; ?? only checks null/undefined',
    impact: 'Bugs where valid falsy values (0, "", false) are incorrectly replaced',
    patterns: [
      /\|\|\s*['"`]/g,
      /\|\|\s*\d+/g,
      /\|\|\s*false/g,
      /\|\|\s*\[\]/g,
      /\|\|\s*\{\}/g,
    ],
    staticConfidence: 'MEDIUM',
    antiPattern: {
      code: `const count = response.count || 10; // Bug: 0 becomes 10!
const name = user.name || 'Anonymous'; // Bug: "" becomes 'Anonymous'!`,
      explanation: '|| replaces all falsy values, not just null/undefined',
    },
    bestPractice: {
      code: `const count = response.count ?? 10; // 0 is preserved
const name = user.name ?? 'Anonymous'; // "" is preserved`,
      explanation: '?? only replaces null or undefined values',
    },
    references: [
      'https://typescript-eslint.io/rules/prefer-nullish-coalescing/',
    ],
    filePatterns: ['*.ts', '*.tsx'],
    enabledByDefault: true,
  },
  {
    id: 'strict-boolean-expressions',
    category: 'null-safety',
    severity: 'MEDIUM',
    name: 'Use explicit boolean conditions',
    description: 'Implicit boolean coercion can lead to subtle bugs with falsy values',
    impact: 'Bugs with 0, "", NaN being treated as false in conditions',
    patterns: [
      /if\s*\(\s*\w+\s*\)\s*{/g,
      /\?\s*\w+\s*:\s*\w+/g,
    ],
    staticConfidence: 'LOW',
    antiPattern: {
      code: `if (count) { ... } // false when count is 0
if (name) { ... }  // false when name is ""`,
      explanation: 'Truthy check treats valid falsy values as false',
    },
    bestPractice: {
      code: `if (count !== undefined && count !== null) { ... }
if (count != null) { ... } // Shorthand for above
if (typeof name === 'string' && name.length > 0) { ... }`,
      explanation: 'Explicit checks prevent bugs with falsy values',
    },
    references: [
      'https://typescript-eslint.io/rules/strict-boolean-expressions/',
    ],
    filePatterns: ['*.ts', '*.tsx'],
    enabledByDefault: true,
  },
  {
    id: 'no-unnecessary-condition',
    category: 'null-safety',
    severity: 'LOW',
    name: 'Remove unnecessary null checks',
    description: 'Checking for null when the type cannot be null is dead code',
    impact: 'Dead code, confusion about actual nullability',
    patterns: [
      /if\s*\(\s*\w+\s*!==?\s*null\s*\)/g,
      /if\s*\(\s*\w+\s*!==?\s*undefined\s*\)/g,
    ],
    staticConfidence: 'LOW',
    aiPromptContext: 'Check if the variable type actually allows null/undefined before flagging',
    antiPattern: {
      code: `function greet(name: string) {
  if (name !== null) { // Unnecessary: string cannot be null
    console.log(name);
  }
}`,
      explanation: 'The type already excludes null, making the check unnecessary',
    },
    bestPractice: {
      code: `function greet(name: string) {
  console.log(name); // No need to check: type guarantees non-null
}`,
      explanation: 'Trust the type system when types are properly defined',
    },
    references: [
      'https://typescript-eslint.io/rules/no-unnecessary-condition/',
    ],
    filePatterns: ['*.ts', '*.tsx'],
    enabledByDefault: false,
  },
];
