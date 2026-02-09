import type { TypeScriptRule } from '../types';

export const genericsRules: TypeScriptRule[] = [
  {
    id: 'no-unnecessary-type-arguments',
    category: 'generics',
    severity: 'LOW',
    name: 'Remove unnecessary type arguments',
    description: 'TypeScript can infer type arguments in most cases',
    impact: 'Verbose code, harder to read, potential for type mismatches',
    patterns: [
      /useState<\w+>\(\w+\)/g,
      /useRef<\w+>\(\w+\)/g,
      /Array<\w+>\(\)/g,
      /new Map<\w+,\s*\w+>\(\)/g,
      /new Set<\w+>\(\)/g,
    ],
    staticConfidence: 'MEDIUM',
    antiPattern: {
      code: `const [count, setCount] = useState<number>(0);
const items = new Array<string>();`,
      explanation: 'Type can be inferred from the initial value',
    },
    bestPractice: {
      code: `const [count, setCount] = useState(0); // Inferred as number
const items: string[] = []; // Explicit when no initial value`,
      explanation: 'Let TypeScript infer when possible, be explicit when needed',
    },
    references: [
      'https://typescript-eslint.io/rules/no-unnecessary-type-arguments/',
    ],
    filePatterns: ['*.ts', '*.tsx'],
    enabledByDefault: true,
  },
  {
    id: 'no-misused-generics',
    category: 'generics',
    severity: 'HIGH',
    name: 'Avoid single-use generic type parameters',
    description: 'A generic type parameter should appear at least twice to be useful',
    impact: 'Unnecessary complexity, no actual type relationship enforced',
    patterns: [
      /function\s+\w+<T>\s*\([^)]*\):\s*(?!.*T)[^{]+{/g,
    ],
    staticConfidence: 'LOW',
    aiPromptContext: 'Check if the generic type parameter T is used more than once in the function signature',
    antiPattern: {
      code: `function process<T>(callback: () => void): void { ... }`,
      explanation: 'Generic T is declared but never used meaningfully',
    },
    bestPractice: {
      code: `function process(callback: () => void): void { ... }
// Or when T is actually needed:
function transform<T>(input: T): T { return input; }`,
      explanation: 'Only use generics when they create meaningful type relationships',
    },
    references: [
      'https://typescript-eslint.io/rules/no-unnecessary-type-parameters/',
    ],
    filePatterns: ['*.ts', '*.tsx'],
    enabledByDefault: true,
  },
  {
    id: 'prefer-generic-constraints',
    category: 'generics',
    severity: 'MEDIUM',
    name: 'Add constraints to generic type parameters',
    description: 'Unconstrained generics provide less type safety than constrained ones',
    impact: 'Any type can be passed, losing the benefits of type checking',
    patterns: [
      /function\s+\w+<T>\s*\(/g,
      /<T>\s*\(/g,
      /class\s+\w+<T>\s*{/g,
    ],
    staticConfidence: 'LOW',
    aiPromptContext: 'Only flag if the function uses properties/methods on T without constraints',
    antiPattern: {
      code: `function getLength<T>(item: T): number {
  return item.length; // Error: Property 'length' does not exist on type 'T'
}`,
      explanation: 'T has no constraints, so TypeScript cannot know what properties it has',
    },
    bestPractice: {
      code: `function getLength<T extends { length: number }>(item: T): number {
  return item.length; // OK: T is guaranteed to have length
}`,
      explanation: 'Constraints define what the generic type must support',
    },
    references: [
      'https://www.typescriptlang.org/docs/handbook/2/generics.html#generic-constraints',
    ],
    filePatterns: ['*.ts', '*.tsx'],
    enabledByDefault: true,
  },
  {
    id: 'consistent-generic-constructors',
    category: 'generics',
    severity: 'LOW',
    name: 'Use consistent generic constructor style',
    description: 'Generic type arguments should be specified consistently',
    impact: 'Inconsistent code style, harder to read',
    patterns: [
      /new\s+\w+<[^>]+>\s*\(\)/g,
      /:\s*\w+<[^>]+>\s*=\s*new\s+\w+\s*\(\)/g,
    ],
    staticConfidence: 'LOW',
    antiPattern: {
      code: `const map: Map<string, number> = new Map();`,
      explanation: 'Type is specified on variable but not constructor (or vice versa)',
    },
    bestPractice: {
      code: `const map = new Map<string, number>();
// Or:
const map: Map<string, number> = new Map<string, number>();`,
      explanation: 'Be consistent with where you specify generic types',
    },
    references: [
      'https://typescript-eslint.io/rules/consistent-generic-constructors/',
    ],
    filePatterns: ['*.ts', '*.tsx'],
    enabledByDefault: false,
  },
];
