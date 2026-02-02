import type { PerformanceIssue, JSSyntaxImprovement, Severity } from '../types';

const JS2026_PATTERNS: {
  pattern: RegExp;
  feature: string;
  benefit: string;
  transform: (match: string, code: string) => string;
}[] = [
  {
    pattern: /\.then\s*\(\s*(?:async\s*)?\(?([^)]*)\)?\s*=>\s*\{([^}]+)\}\s*\)/g,
    feature: 'Top-level await / async-await',
    benefit: 'Cleaner async flow, better error handling with try-catch',
    transform: (match, code) => code.replace(match, 'await (async () => { $2 })()')
  },
  {
    pattern: /(\w+)\s*\?\s*(\w+)\s*:\s*(\w+)/g,
    feature: 'Nullish coalescing (??)',
    benefit: 'More precise null/undefined checks, avoids falsy value issues',
    transform: (match) => match.replace(/\s*\?\s*/, ' ?? ').replace(/\s*:\s*\w+$/, '')
  },
  {
    pattern: /if\s*\(\s*(\w+)\s*!==?\s*null\s*&&\s*\1\s*!==?\s*undefined\s*\)/g,
    feature: 'Optional chaining (?.)',
    benefit: 'Concise null checks, prevents TypeError on undefined access',
    transform: (match, code) => code.replace(match, `if ($1)`)
  },
  {
    pattern: /Object\.assign\s*\(\s*\{\s*\}\s*,\s*([^)]+)\)/g,
    feature: 'Spread operator (...)',
    benefit: 'More readable, slightly faster shallow copy',
    transform: (match) => match.replace(/Object\.assign\s*\(\s*\{\s*\}\s*,\s*/, '{ ...').replace(/\)$/, ' }')
  },
  {
    pattern: /\.concat\s*\(\s*([^)]+)\)/g,
    feature: 'Array spread ([...arr])',
    benefit: 'More readable array concatenation',
    transform: (match, code) => code.replace(/\.concat\s*\(\s*([^)]+)\)/, ', ...$1]')
  },
  {
    pattern: /for\s*\(\s*(?:var|let)\s+\w+\s*=\s*0\s*;\s*\w+\s*<\s*(\w+)\.length\s*;\s*\w+\+\+\s*\)/g,
    feature: 'for...of loop',
    benefit: 'Cleaner iteration, works with any iterable',
    transform: (match) => match.replace(/for\s*\([^)]+\)/, 'for (const item of $1)')
  },
  {
    pattern: /(\w+)\.map\s*\(\s*(?:function\s*\([^)]*\)|[^=]*=>)\s*\{?\s*return\s+\1\[(\w+)\]\.(\w+)\s*;?\s*\}?\s*\)/g,
    feature: 'Array destructuring in map',
    benefit: 'More concise extraction',
    transform: (match) => match.replace(/\.map\s*\([^)]+\)/, '.map(({ $3 }) => $3)')
  },
  {
    pattern: /new Promise\s*\(\s*(?:function\s*)?\(\s*resolve\s*(?:,\s*reject)?\s*\)\s*(?:=>)?\s*\{[^}]*setTimeout/g,
    feature: 'Promise.withResolvers() / scheduler.wait()',
    benefit: 'Cleaner promise creation, native delay support',
    transform: (match) => match.replace(/new Promise[^{]+\{/, 'const { promise, resolve } = Promise.withResolvers(); ')
  },
  {
    pattern: /Array\.from\s*\(\s*\{\s*length\s*:\s*(\d+)\s*\}\s*,\s*\(\s*_\s*,\s*i\s*\)\s*=>\s*i\s*\)/g,
    feature: 'Array.fromAsync() / Iterator.range()',
    benefit: 'Native range generation (ES2025+)',
    transform: (match, code) => code.replace(match, 'Iterator.range(0, $1).toArray()')
  },
  {
    pattern: /JSON\.parse\s*\(\s*JSON\.stringify\s*\(\s*([^)]+)\s*\)\s*\)/g,
    feature: 'structuredClone()',
    benefit: 'Native deep clone, handles more types, better performance',
    transform: (match) => match.replace(/JSON\.parse\s*\(\s*JSON\.stringify\s*\(\s*([^)]+)\s*\)\s*\)/, 'structuredClone($1)')
  },
  {
    pattern: /\.filter\s*\(\s*[^)]+\)\s*\.map\s*\(\s*[^)]+\)/g,
    feature: 'Iterator helpers (.filter().map() → single pass)',
    benefit: 'Single iteration instead of two, better memory efficiency',
    transform: (match) => match.replace(/\.filter/, '.values().filter').replace(/\.map\s*\(/, '.map(')
  },
  {
    pattern: /(\w+)\.hasOwnProperty\s*\(\s*(['"`][^'"`]+['"`])\s*\)/g,
    feature: 'Object.hasOwn()',
    benefit: 'Safer property check, works with null prototype objects',
    transform: (match) => match.replace(/(\w+)\.hasOwnProperty\s*\(\s*(['"`][^'"`]+['"`])\s*\)/, 'Object.hasOwn($1, $2)')
  },
  {
    pattern: /\.reduce\s*\(\s*\(\s*acc\s*,\s*\w+\s*\)\s*=>\s*\{\s*acc\[([^\]]+)\]\s*=\s*([^;]+);\s*return\s+acc;\s*\}\s*,\s*\{\s*\}\s*\)/g,
    feature: 'Object.fromEntries() with map',
    benefit: 'More declarative object creation from arrays',
    transform: (match) => match.replace(/\.reduce[^)]+\)/, '.map(item => [$1, $2])).then(Object.fromEntries)')
  },
  {
    pattern: /await\s+(\w+)\s*;\s*await\s+(\w+)\s*;/g,
    feature: 'Promise.all() for independent promises',
    benefit: 'Parallel execution, faster overall completion',
    transform: (match) => match.replace(/await\s+(\w+)\s*;\s*await\s+(\w+)\s*;/, 'await Promise.all([$1, $2]);')
  },
  {
    pattern: /typeof\s+(\w+)\s*===?\s*['"]undefined['"]/g,
    feature: 'Optional chaining / nullish check',
    benefit: 'More concise undefined checks',
    transform: (match) => match.replace(/typeof\s+(\w+)\s*===?\s*['"]undefined['"]/, '$1 === undefined')
  }
];

const PERFORMANCE_ANTIPATTERNS: {
  pattern: RegExp;
  type: PerformanceIssue['type'];
  description: string;
  impact: string;
  optimization: string;
  getOptimizedCode: (match: string) => string;
}[] = [
  {
    pattern: /for\s*\([^)]+\)\s*\{[^}]*for\s*\([^)]+\)\s*\{/g,
    type: 'O_N2',
    description: 'Nested loops detected - potential O(n²) complexity',
    impact: 'Performance degrades quadratically with input size',
    optimization: 'Consider using Map/Set for O(1) lookups, or restructure algorithm',
    getOptimizedCode: (match) => `// Consider using Map for O(1) lookups:\nconst lookup = new Map(items.map(i => [i.key, i]));\nfor (const item of items) {\n  const related = lookup.get(item.relatedKey);\n}`
  },
  {
    pattern: /\.filter\s*\([^)]+\)\s*\[\s*0\s*\]/g,
    type: 'O_N2',
    description: 'Using .filter()[0] instead of .find()',
    impact: 'Iterates entire array when only first match needed',
    optimization: 'Use .find() for single element lookup',
    getOptimizedCode: (match) => match.replace(/\.filter\s*\(([^)]+)\)\s*\[\s*0\s*\]/, '.find($1)')
  },
  {
    pattern: /\.indexOf\s*\([^)]+\)\s*(?:!==?|>=?|===?)\s*-?[01]/g,
    type: 'O_N2',
    description: 'Using indexOf for existence check',
    impact: 'O(n) lookup when O(1) possible with Set',
    optimization: 'Use Set.has() or Array.includes() for cleaner code',
    getOptimizedCode: (match) => match.replace(/\.indexOf\s*\(([^)]+)\)\s*(?:!==?|>=?)\s*-1/, '.includes($1)')
  },
  {
    pattern: /(?:setState|set\w+)\s*\(\s*\{[^}]*\}\s*\)\s*;?\s*(?:setState|set\w+)\s*\(/g,
    type: 'EXCESSIVE_RENDERS',
    description: 'Multiple setState calls in sequence',
    impact: 'Causes multiple re-renders, potential UI flickering',
    optimization: 'Batch state updates or use useReducer',
    getOptimizedCode: () => `// Batch updates:\nsetState(prev => ({ ...prev, field1: value1, field2: value2 }));`
  },
  {
    pattern: /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{[^}]*fetch\s*\([^}]+\}\s*,\s*\[\s*\]\s*\)/g,
    type: 'MEMORY_BLOAT',
    description: 'Fetch in useEffect without cleanup',
    impact: 'Memory leak if component unmounts during fetch',
    optimization: 'Add AbortController for cleanup',
    getOptimizedCode: () => `useEffect(() => {
  const controller = new AbortController();
  fetch(url, { signal: controller.signal }).then(/*...*/);
  return () => controller.abort();
}, []);`
  },
  {
    pattern: /new\s+Array\s*\(\s*\d{6,}\s*\)/g,
    type: 'MEMORY_BLOAT',
    description: 'Large array pre-allocation',
    impact: 'Immediate memory allocation, potential OOM',
    optimization: 'Use lazy initialization or generators',
    getOptimizedCode: (match) => match.replace(/new\s+Array\s*\(\s*(\d+)\s*\)/, 'function* range(n) { for(let i=0; i<n; i++) yield i; }')
  },
  {
    pattern: /JSON\.parse\s*\(\s*JSON\.stringify/g,
    type: 'BLOCKING_MAIN_THREAD',
    description: 'JSON deep clone blocks main thread',
    impact: 'Synchronous operation, freezes UI for large objects',
    optimization: 'Use structuredClone() or web worker for large data',
    getOptimizedCode: (match) => match.replace(/JSON\.parse\s*\(\s*JSON\.stringify\s*\(([^)]+)\)\s*\)/, 'structuredClone($1)')
  },
  {
    pattern: /localStorage\.(?:get|set)Item\s*\(/g,
    type: 'BLOCKING_MAIN_THREAD',
    description: 'Synchronous localStorage access',
    impact: 'Blocks main thread, affects page responsiveness',
    optimization: 'Use IndexedDB or cache with async wrapper',
    getOptimizedCode: () => `// Async localStorage wrapper:\nconst storage = {\n  async get(key) { return localStorage.getItem(key); },\n  async set(key, val) { localStorage.setItem(key, val); }\n};`
  },
  {
    pattern: /document\.querySelector(?:All)?\s*\([^)]+\)/g,
    type: 'BLOCKING_MAIN_THREAD',
    description: 'DOM query in render path',
    impact: 'Forces layout recalculation',
    optimization: 'Use React refs or cache selectors outside render',
    getOptimizedCode: () => `// Use ref instead:\nconst elementRef = useRef<HTMLElement>(null);\n// Access via: elementRef.current`
  },
  {
    pattern: /import\s*\(\s*['"`][^'"`]+['"`]\s*\)/g,
    type: 'LARGE_BUNDLE',
    description: 'Dynamic import without route-based splitting',
    impact: 'May load unnecessary code upfront',
    optimization: 'Combine with React.lazy for route-based code splitting',
    getOptimizedCode: (match) => `const Component = React.lazy(() => ${match});`
  },
  {
    pattern: /(?:async\s+)?function\s+\w+[^{]*\{(?:[^}]*await[^}]*){5,}/g,
    type: 'BLOCKING_MAIN_THREAD',
    description: 'Sequential awaits in async function',
    impact: 'Waterfall requests, slower overall execution',
    optimization: 'Use Promise.all() for independent operations',
    getOptimizedCode: () => `// Parallel execution:\nconst [result1, result2, result3] = await Promise.all([\n  fetch(url1),\n  fetch(url2),\n  fetch(url3)\n]);`
  },
  {
    pattern: /\.sort\s*\(\s*\)\s*\.slice\s*\(\s*0\s*,\s*\d+\s*\)/g,
    type: 'O_N_LOG_N',
    description: 'Full sort for partial results',
    impact: 'O(n log n) when O(n) possible with partial sort',
    optimization: 'Use heap/quickselect for top-k elements',
    getOptimizedCode: () => `// For top-k, consider:\nfunction topK(arr, k, compareFn) {\n  const heap = arr.slice(0, k).sort(compareFn);\n  for (let i = k; i < arr.length; i++) {\n    if (compareFn(arr[i], heap[k-1]) < 0) {\n      heap[k-1] = arr[i];\n      heap.sort(compareFn);\n    }\n  }\n  return heap;\n}`
  }
];

export function analyzePerformance(code: string, fileName: string): PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];
  const lines = code.split('\n');
  
  for (const antipattern of PERFORMANCE_ANTIPATTERNS) {
    let match: RegExpExecArray | null;
    antipattern.pattern.lastIndex = 0;
    
    while ((match = antipattern.pattern.exec(code)) !== null) {
      const lineNumber = code.slice(0, match.index).split('\n').length;
      const snippet = lines.slice(Math.max(0, lineNumber - 2), lineNumber + 3).join('\n');
      
      issues.push({
        type: antipattern.type,
        severity: antipattern.type === 'O_N2' || antipattern.type === 'MEMORY_BLOAT' ? 'HIGH' as Severity : 'MEDIUM' as Severity,
        file_name: fileName,
        line_numbers: String(lineNumber),
        description: antipattern.description,
        impact: antipattern.impact,
        optimization: antipattern.optimization,
        snippet,
        optimized_code: antipattern.getOptimizedCode(match[0])
      });
    }
  }
  
  return issues;
}

export function analyzeJS2026Syntax(code: string, fileName: string): JSSyntaxImprovement[] {
  const improvements: JSSyntaxImprovement[] = [];
  const lines = code.split('\n');
  
  for (const pattern of JS2026_PATTERNS) {
    let match: RegExpExecArray | null;
    pattern.pattern.lastIndex = 0;
    
    while ((match = pattern.pattern.exec(code)) !== null) {
      const lineNumber = code.slice(0, match.index).split('\n').length;
      const oldCode = lines.slice(Math.max(0, lineNumber - 1), lineNumber + 2).join('\n');
      
      improvements.push({
        old_pattern: match[0].slice(0, 50) + (match[0].length > 50 ? '...' : ''),
        new_pattern: pattern.feature,
        js2026_feature: pattern.feature,
        benefit: pattern.benefit,
        file_name: fileName,
        line_numbers: String(lineNumber),
        old_code: oldCode,
        new_code: pattern.transform(match[0], oldCode),
        description: `Replace ${match[0].slice(0, 30)}... with ${pattern.feature}`
      });
    }
  }
  
  return improvements;
}

export function analyzeDiffForPerformance(diff: string): {
  performanceIssues: PerformanceIssue[];
  syntaxImprovements: JSSyntaxImprovement[];
} {
  const performanceIssues: PerformanceIssue[] = [];
  const syntaxImprovements: JSSyntaxImprovement[] = [];
  
  const filePattern = /^\+\+\+\s+(?:b\/)?(.+)$/gm;
  const addedLinePattern = /^\+(?!\+\+)(.*)$/gm;
  
  let currentFile = '';
  const fileContents = new Map<string, string[]>();
  
  for (const line of diff.split('\n')) {
    const fileMatch = line.match(/^\+\+\+\s+(?:b\/)?(.+)$/);
    if (fileMatch) {
      currentFile = fileMatch[1];
      fileContents.set(currentFile, []);
      continue;
    }
    
    if (currentFile && line.startsWith('+') && !line.startsWith('+++')) {
      fileContents.get(currentFile)?.push(line.slice(1));
    }
  }
  
  for (const [fileName, lines] of fileContents) {
    if (!fileName.match(/\.(ts|tsx|js|jsx)$/)) continue;
    
    const code = lines.join('\n');
    performanceIssues.push(...analyzePerformance(code, fileName));
    syntaxImprovements.push(...analyzeJS2026Syntax(code, fileName));
  }
  
  return { performanceIssues, syntaxImprovements };
}

export function generatePerformancePromptSection(
  performanceIssues: PerformanceIssue[],
  syntaxImprovements: JSSyntaxImprovement[]
): string {
  if (performanceIssues.length === 0 && syntaxImprovements.length === 0) {
    return '';
  }

  let prompt = '\n=== PERFORMANCE & JS 2026 ANALYSIS ===\n';
  
  if (performanceIssues.length > 0) {
    prompt += '\n🔥 PERFORMANCE ISSUES DETECTED:\n';
    for (const issue of performanceIssues.slice(0, 10)) {
      prompt += `\n[${issue.type}] ${issue.file_name}:${issue.line_numbers}\n`;
      prompt += `  Issue: ${issue.description}\n`;
      prompt += `  Impact: ${issue.impact}\n`;
      prompt += `  Fix: ${issue.optimization}\n`;
    }
  }
  
  if (syntaxImprovements.length > 0) {
    prompt += '\n✨ JS 2026 SYNTAX IMPROVEMENTS:\n';
    for (const improvement of syntaxImprovements.slice(0, 10)) {
      prompt += `\n[${improvement.js2026_feature}] ${improvement.file_name}:${improvement.line_numbers}\n`;
      prompt += `  Current: ${improvement.old_pattern}\n`;
      prompt += `  Modern: ${improvement.new_pattern}\n`;
      prompt += `  Benefit: ${improvement.benefit}\n`;
    }
  }
  
  return prompt;
}
