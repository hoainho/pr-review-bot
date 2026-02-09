import type { ReactRule } from '../types';

export const JAVASCRIPT_RULES: ReactRule[] = [
  {
    id: 'js-set-map-lookups',
    category: 'javascript',
    severity: 'MEDIUM',
    name: 'Use Set/Map for O(1) Lookups',
    description: 'Replace array.includes() with Set.has() for repeated lookups',
    impact: 'O(1) instead of O(n) for each lookup - significant for large datasets',
    patterns: [
      /(?:for|while|\.forEach|\.map|\.filter|\.some|\.every)\s*\([^)]*\)\s*(?:\{|\s*=>)[\s\S]*?\.includes\s*\(/g,
    ],
    staticConfidence: 'MEDIUM',
    antiPattern: {
      code: `const allowedIds = ['id1', 'id2', 'id3', ...hundredMore];

const filtered = items.filter(item => 
  allowedIds.includes(item.id) // O(n) for each item
);`,
      explanation: 'includes() scans array for each filter iteration - O(n*m)',
    },
    bestPractice: {
      code: `const allowedIds = new Set(['id1', 'id2', 'id3', ...hundredMore]);

const filtered = items.filter(item => 
  allowedIds.has(item.id) // O(1) for each item
);`,
      explanation: 'Set.has() is O(1) - total complexity O(n)',
    },
    aiPromptContext: 'Look for .includes() inside loops or array methods with large lookup arrays',
    filePatterns: ['*.ts', '*.tsx', '*.js', '*.jsx'],
    enabledByDefault: true,
  },
  {
    id: 'js-index-maps',
    category: 'javascript',
    severity: 'MEDIUM',
    name: 'Build Index Maps for Repeated Lookups',
    description: 'Create Map from array for O(1) lookups by key',
    impact: 'Eliminates repeated .find() calls - O(1) instead of O(n)',
    patterns: [
      /\.find\s*\(\s*\w+\s*=>\s*\w+\.\w+\s*===?\s*\w+\s*\)/g,
    ],
    staticConfidence: 'LOW',
    antiPattern: {
      code: `function getUser(users, id) {
  return users.find(u => u.id === id); // O(n) each call
}

// Called many times with same array
items.forEach(item => {
  const user = getUser(users, item.userId);
});`,
      explanation: 'find() scans array for each lookup - O(n*m) total',
    },
    bestPractice: {
      code: `const userMap = new Map(users.map(u => [u.id, u]));

items.forEach(item => {
  const user = userMap.get(item.userId); // O(1) each call
});`,
      explanation: 'Build Map once, O(1) lookups - total O(n+m)',
    },
    aiPromptContext: 'Look for repeated .find() calls with same array and different search values',
    filePatterns: ['*.ts', '*.tsx', '*.js', '*.jsx'],
    enabledByDefault: true,
  },
  {
    id: 'js-combine-iterations',
    category: 'javascript',
    severity: 'LOW',
    name: 'Combine Multiple Array Iterations',
    description: 'Combine chained .filter().map() into single iteration',
    impact: 'Reduces array iterations and intermediate allocations',
    patterns: [
      /\.filter\s*\([^)]+\)\s*\.map\s*\([^)]+\)/g,
      /\.map\s*\([^)]+\)\s*\.filter\s*\([^)]+\)/g,
    ],
    staticConfidence: 'LOW',
    antiPattern: {
      code: `const result = items
  .filter(item => item.active)
  .map(item => item.name)
  .filter(name => name.length > 3);`,
      explanation: 'Three iterations through the data',
    },
    bestPractice: {
      code: `const result = items.reduce((acc, item) => {
  if (item.active && item.name.length > 3) {
    acc.push(item.name);
  }
  return acc;
}, []);`,
      explanation: 'Single iteration - more efficient for large arrays',
    },
    aiPromptContext: 'For small arrays (<100 items), readability may be more important than performance',
    filePatterns: ['*.ts', '*.tsx', '*.js', '*.jsx'],
    enabledByDefault: false,
  },
  {
    id: 'js-early-return',
    category: 'javascript',
    severity: 'LOW',
    name: 'Early Return from Functions',
    description: 'Return early to avoid unnecessary computation',
    impact: 'Skips computation when result is already determined',
    staticConfidence: 'LOW',
    antiPattern: {
      code: `function processUser(user) {
  let result = null;
  
  if (user) {
    if (user.isActive) {
      result = expensiveOperation(user);
    }
  }
  
  return result;
}`,
      explanation: 'Deep nesting, function body executes even when result is null',
    },
    bestPractice: {
      code: `function processUser(user) {
  if (!user) return null;
  if (!user.isActive) return null;
  
  return expensiveOperation(user);
}`,
      explanation: 'Early returns - clearer flow, skips unnecessary work',
    },
    aiPromptContext: 'Look for deeply nested conditionals that could be flattened with early returns',
    filePatterns: ['*.ts', '*.tsx', '*.js', '*.jsx'],
    enabledByDefault: true,
  },
  {
    id: 'js-hoist-regexp',
    category: 'javascript',
    severity: 'MEDIUM',
    name: 'Hoist RegExp Creation',
    description: 'Create RegExp once outside loops/functions',
    impact: 'Avoids regex compilation overhead on each iteration',
    patterns: [
      /(?:for|while|\.forEach|\.map|\.filter)\s*\([^)]*\)\s*(?:\{|\s*=>)[\s\S]*?(?:new\s+RegExp|\/[^/]+\/[gimsuy]*)\./g,
    ],
    staticConfidence: 'HIGH',
    antiPattern: {
      code: `function validateEmails(emails) {
  return emails.filter(email => {
    const regex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    return regex.test(email);
  });
}`,
      explanation: 'Regex compiled for each email in array',
    },
    bestPractice: {
      code: `const EMAIL_REGEX = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;

function validateEmails(emails) {
  return emails.filter(email => EMAIL_REGEX.test(email));
}`,
      explanation: 'Regex compiled once, reused for all emails',
    },
    aiPromptContext: 'Look for regex literals or new RegExp() inside loops or frequently called functions',
    filePatterns: ['*.ts', '*.tsx', '*.js', '*.jsx'],
    enabledByDefault: true,
  },
  {
    id: 'js-min-max-loop',
    category: 'javascript',
    severity: 'LOW',
    name: 'Use Loop for Min/Max Instead of Sort',
    description: 'Find min/max with single loop instead of sorting',
    impact: 'O(n) instead of O(n log n) for finding extremes',
    patterns: [
      /\.sort\s*\([^)]*\)\s*\[\s*0\s*\]/g,
      /\.sort\s*\([^)]*\)\s*\.(?:at\s*\(\s*-1\s*\)|slice\s*\(\s*-1\s*\))/g,
    ],
    staticConfidence: 'HIGH',
    antiPattern: {
      code: `const maxValue = numbers.sort((a, b) => b - a)[0];
const minValue = numbers.sort((a, b) => a - b)[0];`,
      explanation: 'O(n log n) sort just to find one value',
    },
    bestPractice: {
      code: `const maxValue = Math.max(...numbers);
// Or for very large arrays:
const maxValue = numbers.reduce((max, n) => n > max ? n : max, -Infinity);`,
      explanation: 'O(n) single pass to find extreme value',
    },
    aiPromptContext: 'sort()[0] or sort().at(-1) patterns when only finding min/max',
    filePatterns: ['*.ts', '*.tsx', '*.js', '*.jsx'],
    enabledByDefault: true,
  },
  {
    id: 'js-tosorted-immutable',
    category: 'javascript',
    severity: 'LOW',
    name: 'Use toSorted() for Immutability',
    description: 'Use toSorted() instead of sort() to avoid mutating original array',
    impact: 'Prevents bugs from unintended mutation, clearer intent',
    patterns: [
      /\[\s*\.\.\.\w+\s*\]\s*\.sort\s*\(/g,
      /\.slice\s*\(\s*\)\s*\.sort\s*\(/g,
    ],
    staticConfidence: 'HIGH',
    antiPattern: {
      code: `const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name));
// or
const sorted = items.slice().sort((a, b) => a.name.localeCompare(b.name));`,
      explanation: 'Manual copy before sort - verbose',
    },
    bestPractice: {
      code: `const sorted = items.toSorted((a, b) => a.name.localeCompare(b.name));`,
      explanation: 'toSorted() returns new array - cleaner, clearer intent',
    },
    aiPromptContext: 'toSorted() available in ES2023+, Node 20+, modern browsers',
    filePatterns: ['*.ts', '*.tsx', '*.js', '*.jsx'],
    enabledByDefault: true,
  },
  {
    id: 'js-batch-dom-css',
    category: 'javascript',
    severity: 'LOW',
    name: 'Batch DOM/CSS Changes',
    description: 'Group CSS changes via classes or cssText to avoid layout thrashing',
    impact: 'Reduces reflows by batching style changes',
    patterns: [
      /\.style\.\w+\s*=[\s\S]{0,50}\.style\.\w+\s*=/g,
    ],
    staticConfidence: 'MEDIUM',
    antiPattern: {
      code: `element.style.width = '100px';
element.style.height = '50px';
element.style.backgroundColor = 'red';`,
      explanation: 'Each style change may trigger reflow',
    },
    bestPractice: {
      code: `element.style.cssText = 'width: 100px; height: 50px; background-color: red;';
// or use class:
element.classList.add('my-styles');`,
      explanation: 'Single style application - one reflow',
    },
    aiPromptContext: 'Look for multiple consecutive style property assignments',
    filePatterns: ['*.ts', '*.tsx', '*.js', '*.jsx'],
    enabledByDefault: true,
  },
];
