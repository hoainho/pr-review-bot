import type { TypeScriptRule } from '../types';

export const typeSafetyRules: TypeScriptRule[] = [
  {
    id: 'no-explicit-any',
    category: 'type-safety',
    severity: 'CRITICAL',
    name: 'Avoid explicit any type',
    description: 'Using `any` type bypasses TypeScript type checking and can lead to runtime errors',
    impact: 'Loss of type safety, potential runtime crashes, harder to refactor',
    patterns: [
      /:\s*any\b(?!\s*\[\])/g,
      /as\s+any\b/g,
      /<any>/g,
      /:\s*any\s*\[\]/g,
    ],
    staticConfidence: 'HIGH',
    antiPattern: {
      code: `function process(data: any) {
  return data.someProperty; // No type checking!
}`,
      explanation: '`any` allows any operation without type checking',
    },
    bestPractice: {
      code: `function process<T extends { someProperty: string }>(data: T) {
  return data.someProperty; // Type-safe!
}`,
      explanation: 'Use generics or specific types for type safety',
    },
    references: [
      'https://typescript-eslint.io/rules/no-explicit-any/',
    ],
    filePatterns: ['*.ts', '*.tsx'],
    enabledByDefault: true,
  },
  {
    id: 'no-unsafe-type-assertion',
    category: 'type-safety',
    severity: 'CRITICAL',
    name: 'Avoid unsafe type assertions',
    description: 'Double type assertions (as unknown as T) bypass type checking completely',
    impact: 'Runtime type errors, crashes when types do not match at runtime',
    patterns: [
      /as\s+unknown\s+as\s+\w+/g,
      /as\s+any\s+as\s+\w+/g,
      /<unknown><\w+>/g,
    ],
    staticConfidence: 'HIGH',
    antiPattern: {
      code: `const user = response as unknown as User; // Dangerous!`,
      explanation: 'Double assertion bypasses all type checking',
    },
    bestPractice: {
      code: `function isUser(obj: unknown): obj is User {
  return obj !== null && typeof obj === 'object' && 'id' in obj;
}
const user = isUser(response) ? response : null;`,
      explanation: 'Use type guards for runtime type validation',
    },
    references: [
      'https://typescript-eslint.io/rules/no-unsafe-type-assertion/',
    ],
    filePatterns: ['*.ts', '*.tsx'],
    enabledByDefault: true,
  },
  {
    id: 'no-ts-ignore',
    category: 'type-safety',
    severity: 'HIGH',
    name: 'Avoid @ts-ignore comments',
    description: '@ts-ignore suppresses all TypeScript errors on the next line',
    impact: 'Hides potential bugs, makes code harder to maintain',
    patterns: [
      /@ts-ignore/g,
      /@ts-nocheck/g,
    ],
    staticConfidence: 'HIGH',
    antiPattern: {
      code: `// @ts-ignore
someFunction(wrongType);`,
      explanation: '@ts-ignore hides type errors instead of fixing them',
    },
    bestPractice: {
      code: `// @ts-expect-error - Temporary: API returns wrong type, fix in JIRA-123
someFunction(wrongType as ExpectedType);`,
      explanation: 'Use @ts-expect-error with explanation, or fix the underlying issue',
    },
    references: [
      'https://typescript-eslint.io/rules/ban-ts-comment/',
    ],
    filePatterns: ['*.ts', '*.tsx'],
    enabledByDefault: true,
  },
  {
    id: 'explicit-function-return-type',
    category: 'type-safety',
    severity: 'MEDIUM',
    name: 'Add explicit return types to exported functions',
    description: 'Exported functions should have explicit return types for better API contracts',
    impact: 'Unclear API contracts, potential breaking changes go unnoticed',
    patterns: [
      /export\s+(async\s+)?function\s+\w+\s*\([^)]*\)\s*{/g,
      /export\s+const\s+\w+\s*=\s*(async\s+)?\([^)]*\)\s*=>\s*{/g,
    ],
    staticConfidence: 'MEDIUM',
    antiPattern: {
      code: `export function fetchUser(id: string) {
  return fetch(\`/api/users/\${id}\`).then(r => r.json());
}`,
      explanation: 'Return type is inferred as Promise<any>',
    },
    bestPractice: {
      code: `export async function fetchUser(id: string): Promise<User> {
  const response = await fetch(\`/api/users/\${id}\`);
  return response.json() as User;
}`,
      explanation: 'Explicit return type documents the API contract',
    },
    references: [
      'https://typescript-eslint.io/rules/explicit-function-return-type/',
    ],
    filePatterns: ['*.ts', '*.tsx'],
    enabledByDefault: true,
  },
  {
    id: 'no-object-type',
    category: 'type-safety',
    severity: 'MEDIUM',
    name: 'Avoid object and Object types',
    description: 'The `object` and `Object` types are too broad and provide little type safety',
    impact: 'Weak type checking, any object passes validation',
    patterns: [
      /:\s*object\b/g,
      /:\s*Object\b/g,
      /<object>/g,
      /<Object>/g,
    ],
    staticConfidence: 'HIGH',
    antiPattern: {
      code: `function process(config: object) { ... }`,
      explanation: '`object` accepts any non-primitive value',
    },
    bestPractice: {
      code: `interface Config {
  timeout: number;
  retries: number;
}
function process(config: Config) { ... }`,
      explanation: 'Define specific interfaces for better type checking',
    },
    references: [
      'https://typescript-eslint.io/rules/ban-types/',
    ],
    filePatterns: ['*.ts', '*.tsx'],
    enabledByDefault: true,
  },
];
