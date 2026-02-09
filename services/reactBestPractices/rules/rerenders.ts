import type { ReactRule } from '../types';

export const RERENDER_RULES: ReactRule[] = [
  {
    id: 'rerender-functional-setstate',
    category: 'rerenders',
    severity: 'MEDIUM',
    name: 'Use Functional setState Updates',
    description: 'Use functional form of setState for stable callbacks that depend on previous state',
    impact: 'Prevents stale closure issues and enables callback memoization',
    patterns: [
      /set\w+\s*\(\s*(?!.*=>).*\bstate\b/g,
      /set\w+\s*\(\s*\[\s*\.\.\.(?!prev)/g,
    ],
    staticConfidence: 'MEDIUM',
    antiPattern: {
      code: `function Counter() {
  const [count, setCount] = useState(0);
  
  const increment = useCallback(() => {
    setCount(count + 1); // Captures count, breaks memoization
  }, [count]); // Must include count in deps
  
  return <ExpensiveChild onClick={increment} />;
}`,
      explanation: 'increment changes on every count change, causing ExpensiveChild to re-render',
    },
    bestPractice: {
      code: `function Counter() {
  const [count, setCount] = useState(0);
  
  const increment = useCallback(() => {
    setCount(prev => prev + 1); // No external dependency
  }, []); // Empty deps - stable reference
  
  return <ExpensiveChild onClick={increment} />;
}`,
      explanation: 'increment never changes - ExpensiveChild doesn\'t re-render unnecessarily',
    },
    aiPromptContext: 'Look for setState calls that reference current state directly instead of using functional form',
    filePatterns: ['*.tsx', '*.jsx'],
    enabledByDefault: true,
  },
  {
    id: 'rerender-lazy-state-init',
    category: 'rerenders',
    severity: 'MEDIUM',
    name: 'Use Lazy State Initialization',
    description: 'Pass a function to useState for expensive initial values',
    impact: 'Expensive computation runs once instead of every render',
    patterns: [
      /useState\s*\(\s*\w+\s*\(\s*\)/g,
      /useState\s*\(\s*JSON\.parse/g,
      /useState\s*\(\s*localStorage\./g,
      /useState\s*\(\s*new\s+\w+/g,
    ],
    staticConfidence: 'HIGH',
    antiPattern: {
      code: `function Editor() {
  const [content, setContent] = useState(parseMarkdown(initialValue));
  // parseMarkdown() runs on EVERY render, not just initial
}`,
      explanation: 'parseMarkdown executes every render even though result is ignored after first',
    },
    bestPractice: {
      code: `function Editor() {
  const [content, setContent] = useState(() => parseMarkdown(initialValue));
  // parseMarkdown() runs only on initial render
}`,
      explanation: 'Function form delays execution until first render only',
    },
    aiPromptContext: 'Check if useState argument is a function call that should be lazy initialized',
    filePatterns: ['*.tsx', '*.jsx'],
    enabledByDefault: true,
  },
  {
    id: 'rerender-memo',
    category: 'rerenders',
    severity: 'MEDIUM',
    name: 'Extract to Memoized Components',
    description: 'Wrap expensive computations in React.memo components',
    impact: 'Skips re-rendering expensive subtrees when props haven\'t changed',
    staticConfidence: 'LOW',
    antiPattern: {
      code: `function Dashboard({ user, data }) {
  return (
    <div>
      <UserInfo user={user} />
      <ExpensiveChart data={data} /> {/* Re-renders when user changes */}
    </div>
  );
}`,
      explanation: 'ExpensiveChart re-renders even when only user changes',
    },
    bestPractice: {
      code: `const MemoizedChart = React.memo(function ExpensiveChart({ data }) {
  // Only re-renders when data changes
  return <Chart data={data} />;
});

function Dashboard({ user, data }) {
  return (
    <div>
      <UserInfo user={user} />
      <MemoizedChart data={data} />
    </div>
  );
}`,
      explanation: 'Chart only re-renders when data prop actually changes',
    },
    aiPromptContext: 'Look for expensive components that re-render due to unrelated state changes',
    filePatterns: ['*.tsx', '*.jsx'],
    enabledByDefault: true,
  },
  {
    id: 'rerender-derived-state',
    category: 'rerenders',
    severity: 'MEDIUM',
    name: 'Subscribe to Derived State',
    description: 'Store selectors subscribe to derived booleans, not raw values',
    impact: 'Reduces unnecessary re-renders when raw value changes but derived doesn\'t',
    staticConfidence: 'LOW',
    antiPattern: {
      code: `function CartButton() {
  const items = useStore(state => state.cart.items);
  const hasItems = items.length > 0;
  // Re-renders when any item changes, even if hasItems stays true
  return <button disabled={!hasItems}>Checkout</button>;
}`,
      explanation: 'Subscribes to full array - re-renders on any array change',
    },
    bestPractice: {
      code: `function CartButton() {
  const hasItems = useStore(state => state.cart.items.length > 0);
  // Only re-renders when hasItems boolean changes
  return <button disabled={!hasItems}>Checkout</button>;
}`,
      explanation: 'Subscribes to derived boolean - only re-renders when boolean flips',
    },
    aiPromptContext: 'Check if components subscribe to more state than they actually use',
    filePatterns: ['*.tsx', '*.jsx'],
    enabledByDefault: true,
  },
  {
    id: 'rerender-derived-state-no-effect',
    category: 'rerenders',
    severity: 'MEDIUM',
    name: 'Calculate Derived State During Rendering',
    description: 'Derive state during render instead of in useEffect',
    impact: 'Eliminates extra render cycle and effect overhead',
    patterns: [
      /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{[\s\S]*?set\w+\s*\([^)]*\)[\s\S]*?\}\s*,\s*\[[^\]]*\w+[^\]]*\]\s*\)/g,
    ],
    staticConfidence: 'MEDIUM',
    antiPattern: {
      code: `function FilteredList({ items, filter }) {
  const [filtered, setFiltered] = useState([]);
  
  useEffect(() => {
    setFiltered(items.filter(i => i.type === filter));
  }, [items, filter]); // Extra render cycle
  
  return <List items={filtered} />;
}`,
      explanation: 'Effect runs after render, causing second render',
    },
    bestPractice: {
      code: `function FilteredList({ items, filter }) {
  const filtered = useMemo(
    () => items.filter(i => i.type === filter),
    [items, filter]
  );
  
  return <List items={filtered} />;
}`,
      explanation: 'Computed during render - no extra render cycle',
    },
    aiPromptContext: 'Look for useEffect that only computes derived state from props/state',
    filePatterns: ['*.tsx', '*.jsx'],
    enabledByDefault: true,
  },
  {
    id: 'rerender-useref-transient',
    category: 'rerenders',
    severity: 'LOW',
    name: 'Use useRef for Transient Values',
    description: 'Use refs for frequently changing values that don\'t need to trigger re-renders',
    impact: 'Avoids re-renders for values like scroll position, timers, etc.',
    patterns: [
      /useState\s*\(\s*(?:0|null|false)\s*\)[\s\S]{0,200}(?:onScroll|onMouseMove|setInterval|requestAnimationFrame)/g,
    ],
    staticConfidence: 'LOW',
    antiPattern: {
      code: `function ScrollTracker() {
  const [scrollY, setScrollY] = useState(0);
  
  useEffect(() => {
    const handler = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);
  
  console.log('Current scroll:', scrollY); // Re-renders on every scroll
}`,
      explanation: 'Every scroll event triggers a re-render',
    },
    bestPractice: {
      code: `function ScrollTracker() {
  const scrollY = useRef(0);
  
  useEffect(() => {
    const handler = () => {
      scrollY.current = window.scrollY;
      // Use for calculations without re-render
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);
}`,
      explanation: 'Updates without re-rendering - use for transient tracking values',
    },
    aiPromptContext: 'Look for useState with high-frequency updates that don\'t affect UI directly',
    filePatterns: ['*.tsx', '*.jsx'],
    enabledByDefault: true,
  },
  {
    id: 'rerender-transitions',
    category: 'rerenders',
    severity: 'MEDIUM',
    name: 'Use Transitions for Non-Urgent Updates',
    description: 'Use startTransition for updates that can be deferred',
    impact: 'Keeps UI responsive by not blocking urgent updates',
    staticConfidence: 'LOW',
    antiPattern: {
      code: `function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  
  const handleChange = (e) => {
    setQuery(e.target.value);
    setResults(filterData(e.target.value)); // Blocks input
  };
}`,
      explanation: 'Heavy filtering blocks input responsiveness',
    },
    bestPractice: {
      code: `import { useState, useTransition } from 'react';

function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isPending, startTransition] = useTransition();
  
  const handleChange = (e) => {
    setQuery(e.target.value); // Urgent - update input immediately
    startTransition(() => {
      setResults(filterData(e.target.value)); // Deferred - can be interrupted
    });
  };
}`,
      explanation: 'Input stays responsive while results update in background',
    },
    aiPromptContext: 'Look for state updates that could be deferred (search results, filtered lists, etc.)',
    filePatterns: ['*.tsx', '*.jsx'],
    enabledByDefault: true,
  },
  {
    id: 'rerender-default-props',
    category: 'rerenders',
    severity: 'MEDIUM',
    name: 'Hoist Default Non-primitive Props',
    description: 'Extract default non-primitive values outside component to preserve referential equality',
    impact: 'Prevents memo invalidation from recreated default values',
    patterns: [
      /(?:function|const)\s+\w+\s*=?\s*(?:React\.)?memo\s*\(\s*(?:function\s*)?\(\s*\{[^}]*=\s*(?:\[\s*\]|\{\s*\})/g,
    ],
    staticConfidence: 'HIGH',
    antiPattern: {
      code: `const MemoizedList = React.memo(function List({ items = [] }) {
  // [] creates new array every render - memo never works
  return items.map(i => <Item key={i.id} {...i} />);
});`,
      explanation: 'Default [] is recreated each render, breaking memoization',
    },
    bestPractice: {
      code: `const DEFAULT_ITEMS = [];

const MemoizedList = React.memo(function List({ items = DEFAULT_ITEMS }) {
  return items.map(i => <Item key={i.id} {...i} />);
});`,
      explanation: 'Constant reference - memo works correctly',
    },
    aiPromptContext: 'Look for inline default values ([], {}) in memoized component parameters',
    filePatterns: ['*.tsx', '*.jsx'],
    enabledByDefault: true,
  },
];
