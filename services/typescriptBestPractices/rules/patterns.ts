import type { TypeScriptRule } from '../types';

export const patternRules: TypeScriptRule[] = [
  {
    id: 'prefer-discriminated-unions',
    category: 'patterns',
    severity: 'MEDIUM',
    name: 'Use discriminated unions for state types',
    description: 'Discriminated unions enable exhaustive type checking in switch statements',
    impact: 'Runtime errors from missing state handling, harder to maintain',
    patterns: [
      /interface\s+\w+\s*{\s*status\s*:\s*string/g,
      /type\s+\w+\s*=\s*{\s*state\s*:\s*string/g,
    ],
    staticConfidence: 'LOW',
    aiPromptContext: 'Look for types with a status/state/type/kind field that could be a literal union',
    antiPattern: {
      code: `interface Response {
  status: string;
  data?: User;
  error?: string;
}
// data and error can both be present or absent`,
      explanation: 'String status does not narrow the type',
    },
    bestPractice: {
      code: `type Response = 
  | { status: 'success'; data: User }
  | { status: 'error'; error: string }
  | { status: 'loading' };

function handle(res: Response) {
  switch (res.status) {
    case 'success': return res.data; // data is guaranteed
    case 'error': return res.error;  // error is guaranteed
    case 'loading': return null;
  }
}`,
      explanation: 'Discriminated unions enable type narrowing',
    },
    references: [
      'https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions',
    ],
    filePatterns: ['*.ts', '*.tsx'],
    enabledByDefault: true,
  },
  {
    id: 'exhaustive-switch',
    category: 'patterns',
    severity: 'HIGH',
    name: 'Ensure exhaustive switch statements',
    description: 'Switch statements on union types should handle all cases',
    impact: 'Runtime errors when new union members are added',
    patterns: [
      /switch\s*\(\w+\)\s*{\s*case/g,
    ],
    staticConfidence: 'LOW',
    aiPromptContext: 'Check if the switch statement has a default case or exhaustive check',
    antiPattern: {
      code: `type Status = 'active' | 'inactive' | 'pending';
function handle(status: Status) {
  switch (status) {
    case 'active': return 1;
    case 'inactive': return 0;
    // Missing 'pending'! No compile error!
  }
}`,
      explanation: 'Missing cases are not caught without exhaustive checking',
    },
    bestPractice: {
      code: `function handle(status: Status): number {
  switch (status) {
    case 'active': return 1;
    case 'inactive': return 0;
    case 'pending': return -1;
    default: {
      const _exhaustive: never = status;
      throw new Error(\`Unhandled status: \${_exhaustive}\`);
    }
  }
}`,
      explanation: 'The never type ensures all cases are handled at compile time',
    },
    references: [
      'https://www.typescriptlang.org/docs/handbook/2/narrowing.html#exhaustiveness-checking',
    ],
    filePatterns: ['*.ts', '*.tsx'],
    enabledByDefault: true,
  },
  {
    id: 'prefer-readonly',
    category: 'patterns',
    severity: 'LOW',
    name: 'Use readonly for immutable data',
    description: 'Readonly properties and arrays prevent accidental mutations',
    impact: 'Unexpected mutations, bugs in pure functions',
    patterns: [
      /interface\s+\w+\s*{\s*\w+\s*:\s*\w+\[\]/g,
      /type\s+\w+\s*=\s*{\s*\w+\s*:\s*\w+\[\]/g,
    ],
    staticConfidence: 'LOW',
    aiPromptContext: 'Suggest readonly for arrays/objects that should not be mutated',
    antiPattern: {
      code: `interface User {
  id: string;
  roles: string[];
}
// roles can be mutated: user.roles.push('admin')`,
      explanation: 'Arrays and objects are mutable by default',
    },
    bestPractice: {
      code: `interface User {
  readonly id: string;
  readonly roles: readonly string[];
}
// Mutation is now a compile error`,
      explanation: 'readonly prevents accidental mutations',
    },
    references: [
      'https://www.typescriptlang.org/docs/handbook/2/objects.html#readonly-properties',
    ],
    filePatterns: ['*.ts', '*.tsx'],
    enabledByDefault: true,
  },
  {
    id: 'prefer-unknown-over-any',
    category: 'patterns',
    severity: 'HIGH',
    name: 'Use unknown instead of any for unknown data',
    description: 'unknown requires type narrowing before use, making it safer than any',
    impact: 'Runtime errors from unvalidated data',
    patterns: [
      /catch\s*\(\s*\w+\s*:\s*any\s*\)/g,
      /JSON\.parse\([^)]+\)\s*:\s*any/g,
    ],
    staticConfidence: 'MEDIUM',
    antiPattern: {
      code: `try {
  riskyOperation();
} catch (error: any) {
  console.log(error.message); // Might crash if error is not an Error!
}`,
      explanation: 'any allows any operation without checking',
    },
    bestPractice: {
      code: `try {
  riskyOperation();
} catch (error: unknown) {
  if (error instanceof Error) {
    console.log(error.message);
  } else {
    console.log(String(error));
  }
}`,
      explanation: 'unknown requires type narrowing for safe access',
    },
    references: [
      'https://www.typescriptlang.org/docs/handbook/2/narrowing.html#the-unknown-type',
    ],
    filePatterns: ['*.ts', '*.tsx'],
    enabledByDefault: true,
  },
  {
    id: 'no-namespace',
    category: 'patterns',
    severity: 'MEDIUM',
    name: 'Avoid TypeScript namespaces',
    description: 'ES modules are the standard; namespaces are a legacy feature',
    impact: 'Non-standard module system, harder to tree-shake',
    patterns: [
      /namespace\s+\w+\s*{/g,
      /module\s+\w+\s*{/g,
    ],
    staticConfidence: 'HIGH',
    antiPattern: {
      code: `namespace Utils {
  export function format(date: Date) { ... }
}
Utils.format(new Date());`,
      explanation: 'Namespaces are a legacy TypeScript feature',
    },
    bestPractice: {
      code: `// utils.ts
export function format(date: Date) { ... }

// consumer.ts
import { format } from './utils';
format(new Date());`,
      explanation: 'ES modules are standard and tree-shakeable',
    },
    references: [
      'https://www.typescriptlang.org/docs/handbook/namespaces-and-modules.html',
    ],
    filePatterns: ['*.ts', '*.tsx'],
    enabledByDefault: true,
  },
  {
    id: 'strict-property-initialization',
    category: 'patterns',
    severity: 'HIGH',
    name: 'Initialize class properties or mark as optional',
    description: 'Uninitialized properties can cause runtime errors',
    impact: 'Runtime "undefined" errors when accessing uninitialized properties',
    patterns: [
      /class\s+\w+\s*{[^}]*\w+\s*:\s*\w+\s*;[^}]*}/g,
    ],
    staticConfidence: 'LOW',
    aiPromptContext: 'Check if class properties are initialized in constructor or declaration',
    antiPattern: {
      code: `class User {
  name: string; // Not initialized!
  
  greet() {
    console.log(this.name.toUpperCase()); // Runtime error!
  }
}`,
      explanation: 'Property is never initialized, causing runtime errors',
    },
    bestPractice: {
      code: `class User {
  name: string;
  
  constructor(name: string) {
    this.name = name; // Initialized in constructor
  }
}
// Or use definite assignment assertion if set elsewhere:
class User {
  name!: string; // Will be set by framework
}`,
      explanation: 'Always initialize properties or use ! with caution',
    },
    references: [
      'https://www.typescriptlang.org/tsconfig#strictPropertyInitialization',
    ],
    filePatterns: ['*.ts', '*.tsx'],
    enabledByDefault: true,
  },
];
