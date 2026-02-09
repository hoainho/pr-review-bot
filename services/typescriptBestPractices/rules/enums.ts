import type { TypeScriptRule } from '../types';

export const enumRules: TypeScriptRule[] = [
  {
    id: 'prefer-const-enum',
    category: 'enums',
    severity: 'MEDIUM',
    name: 'Use const enum for better performance',
    description: 'Regular enums generate extra JavaScript code; const enums are inlined',
    impact: 'Larger bundle size, runtime overhead from enum object lookups',
    patterns: [
      /(?<!const\s)enum\s+\w+\s*{/g,
    ],
    staticConfidence: 'HIGH',
    antiPattern: {
      code: `enum Status {
  Active = 'ACTIVE',
  Inactive = 'INACTIVE',
}
// Generates: var Status; (function(Status) { ... })(Status);`,
      explanation: 'Regular enum creates a runtime object',
    },
    bestPractice: {
      code: `const enum Status {
  Active = 'ACTIVE',
  Inactive = 'INACTIVE',
}
// Inlined at compile time: no runtime overhead`,
      explanation: 'const enum values are inlined, reducing bundle size',
    },
    aiPromptContext: 'Note: const enums cannot be used if you need to iterate over enum values or access them dynamically',
    references: [
      'https://www.typescriptlang.org/docs/handbook/enums.html#const-enums',
    ],
    filePatterns: ['*.ts', '*.tsx'],
    enabledByDefault: true,
  },
  {
    id: 'prefer-union-over-enum',
    category: 'enums',
    severity: 'LOW',
    name: 'Consider string union types over enums',
    description: 'String literal unions are simpler and have zero runtime cost',
    impact: 'Extra bundle size from enum declarations',
    patterns: [
      /enum\s+\w+\s*{\s*\w+\s*=\s*['"][^'"]+['"]/g,
    ],
    staticConfidence: 'MEDIUM',
    antiPattern: {
      code: `enum Color {
  Red = 'red',
  Green = 'green',
  Blue = 'blue',
}`,
      explanation: 'Enum creates a runtime object for simple string values',
    },
    bestPractice: {
      code: `type Color = 'red' | 'green' | 'blue';
// Or with a const object for iteration:
const Colors = ['red', 'green', 'blue'] as const;
type Color = typeof Colors[number];`,
      explanation: 'String unions have zero runtime cost and better IDE support',
    },
    references: [
      'https://blog.logrocket.com/typescript-string-enums-guide/',
    ],
    filePatterns: ['*.ts', '*.tsx'],
    enabledByDefault: false,
  },
  {
    id: 'no-numeric-enum-values',
    category: 'enums',
    severity: 'HIGH',
    name: 'Prefer string enum values over numeric',
    description: 'Numeric enums are less readable in logs/debugging and allow unsafe assignments',
    impact: 'Poor debuggability, potential for incorrect assignments',
    patterns: [
      /enum\s+\w+\s*{\s*\w+\s*(?:=\s*\d+)?\s*,/g,
    ],
    staticConfidence: 'MEDIUM',
    antiPattern: {
      code: `enum Status {
  Active,    // 0
  Inactive,  // 1
}
console.log(status); // Output: 0 (not helpful!)`,
      explanation: 'Numeric values are hard to debug and allow unsafe assignments',
    },
    bestPractice: {
      code: `enum Status {
  Active = 'ACTIVE',
  Inactive = 'INACTIVE',
}
console.log(status); // Output: 'ACTIVE' (clear!)`,
      explanation: 'String values are self-documenting and safer',
    },
    references: [
      'https://typescript-eslint.io/rules/prefer-enum-initializers/',
    ],
    filePatterns: ['*.ts', '*.tsx'],
    enabledByDefault: true,
  },
  {
    id: 'no-mixed-enum-values',
    category: 'enums',
    severity: 'HIGH',
    name: 'Do not mix string and numeric enum values',
    description: 'Mixed enums are confusing and can lead to subtle bugs',
    impact: 'Confusing behavior, harder to maintain',
    patterns: [
      /enum\s+\w+\s*{[^}]*=\s*\d+[^}]*=\s*['"][^}]*}/g,
      /enum\s+\w+\s*{[^}]*=\s*['"][^}]*=\s*\d+[^}]*}/g,
    ],
    staticConfidence: 'HIGH',
    antiPattern: {
      code: `enum Mixed {
  A = 0,
  B = 'B',
  C = 1,
}`,
      explanation: 'Mixing numbers and strings in the same enum is confusing',
    },
    bestPractice: {
      code: `enum Status {
  Active = 'ACTIVE',
  Inactive = 'INACTIVE',
}
// Or if you need numbers:
enum Priority {
  Low = 1,
  Medium = 2,
  High = 3,
}`,
      explanation: 'Use consistent value types within an enum',
    },
    references: [
      'https://www.typescriptlang.org/docs/handbook/enums.html#heterogeneous-enums',
    ],
    filePatterns: ['*.ts', '*.tsx'],
    enabledByDefault: true,
  },
];
