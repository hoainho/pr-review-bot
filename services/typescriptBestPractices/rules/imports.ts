import type { TypeScriptRule } from '../types';

export const importRules: TypeScriptRule[] = [
  {
    id: 'prefer-type-only-imports',
    category: 'imports',
    severity: 'MEDIUM',
    name: 'Use type-only imports for types',
    description: 'Type-only imports are removed at compile time, improving bundle size',
    impact: 'Unnecessary imports in bundle, potential circular dependency issues',
    patterns: [
      /import\s*{\s*(?!type\s)(\w+)\s*}\s*from/g,
    ],
    staticConfidence: 'LOW',
    aiPromptContext: 'Only flag imports that are exclusively used as types (not as values)',
    antiPattern: {
      code: `import { User, UserService } from './users';
// User is only used as a type
function getUser(id: string): User { ... }`,
      explanation: 'User is imported as a value but only used as a type',
    },
    bestPractice: {
      code: `import type { User } from './users';
import { UserService } from './users';
// Or inline:
import { type User, UserService } from './users';`,
      explanation: 'Type-only imports are erased, reducing bundle size',
    },
    references: [
      'https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-8.html#type-only-imports-and-export',
    ],
    filePatterns: ['*.ts', '*.tsx'],
    enabledByDefault: true,
  },
  {
    id: 'no-barrel-imports',
    category: 'imports',
    severity: 'HIGH',
    name: 'Avoid importing from barrel files (index.ts)',
    description: 'Barrel imports can prevent tree-shaking and increase bundle size',
    impact: 'Large bundles, slow build times, potential circular dependencies',
    patterns: [
      /from\s+['"][^'"]*\/index['"]/g,
      /from\s+['"]\.\.?\/[^'"]+\/['"](?!\w)/g,
    ],
    staticConfidence: 'MEDIUM',
    antiPattern: {
      code: `import { Button } from '../components';
// This imports ALL components, even if you only need Button`,
      explanation: 'Barrel imports can pull in entire directories',
    },
    bestPractice: {
      code: `import { Button } from '../components/Button';
// Direct import enables proper tree-shaking`,
      explanation: 'Direct imports allow bundlers to tree-shake unused code',
    },
    references: [
      'https://vercel.com/blog/how-we-optimized-package-imports-in-next-js',
    ],
    filePatterns: ['*.ts', '*.tsx'],
    enabledByDefault: true,
  },
  {
    id: 'no-default-export',
    category: 'imports',
    severity: 'LOW',
    name: 'Prefer named exports over default exports',
    description: 'Named exports are easier to refactor and have better IDE support',
    impact: 'Inconsistent naming, harder to search/refactor',
    patterns: [
      /export\s+default\s+(?:function|class|const)/g,
      /export\s+default\s+\w+;/g,
    ],
    staticConfidence: 'HIGH',
    antiPattern: {
      code: `export default function Button() { ... }
// Import can use any name:
import MyButton from './Button'; // Confusing!`,
      explanation: 'Default exports allow arbitrary import names',
    },
    bestPractice: {
      code: `export function Button() { ... }
// Import must use correct name:
import { Button } from './Button'; // Clear!`,
      explanation: 'Named exports enforce consistent naming',
    },
    references: [
      'https://basarat.gitbook.io/typescript/main-1/defaultisbad',
    ],
    filePatterns: ['*.ts', '*.tsx'],
    enabledByDefault: false,
  },
  {
    id: 'consistent-type-imports',
    category: 'imports',
    severity: 'LOW',
    name: 'Use consistent type import style',
    description: 'Mix of inline and separate type imports reduces code consistency',
    impact: 'Inconsistent code style, harder to maintain',
    patterns: [
      /import\s+type\s*{[^}]+}\s*from/g,
      /import\s*{\s*type\s+\w+/g,
    ],
    staticConfidence: 'MEDIUM',
    antiPattern: {
      code: `import type { User } from './types';
import { type Role, RoleService } from './roles';`,
      explanation: 'Mixing separate and inline type imports',
    },
    bestPractice: {
      code: `// Pick one style and be consistent:
// Style 1: Separate type imports
import type { User, Role } from './types';
import { RoleService } from './roles';
// Style 2: Inline type imports
import { type User, type Role, RoleService } from './users';`,
      explanation: 'Consistency makes code easier to read and maintain',
    },
    references: [
      'https://typescript-eslint.io/rules/consistent-type-imports/',
    ],
    filePatterns: ['*.ts', '*.tsx'],
    enabledByDefault: false,
  },
  {
    id: 'no-import-type-side-effects',
    category: 'imports',
    severity: 'MEDIUM',
    name: 'Avoid side-effect imports',
    description: 'Side-effect imports (import "x") are hard to tree-shake and understand',
    impact: 'Unclear dependencies, bundle size issues',
    patterns: [
      /import\s+['"][^'"]+['"];?\s*$/gm,
    ],
    staticConfidence: 'HIGH',
    antiPattern: {
      code: `import './styles.css';
import 'reflect-metadata';`,
      explanation: 'Side-effect imports have unclear purpose and cannot be tree-shaken',
    },
    bestPractice: {
      code: `// For CSS, use CSS modules or bundler-specific syntax
import styles from './styles.module.css';
// For polyfills, document why they are needed
// @see https://... - Required for decorator metadata
import 'reflect-metadata';`,
      explanation: 'Document side-effect imports and prefer explicit imports',
    },
    references: [
      'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import#import_a_module_for_its_side_effects_only',
    ],
    filePatterns: ['*.ts', '*.tsx'],
    enabledByDefault: true,
  },
];
