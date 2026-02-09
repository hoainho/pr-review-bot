import type { ReactRule } from '../types';

export const RENDERING_RULES: ReactRule[] = [
  {
    id: 'rendering-conditional-render',
    category: 'rendering',
    severity: 'LOW',
    name: 'Use Explicit Conditional Rendering',
    description: 'Use ternary operator instead of && for conditional rendering',
    impact: 'Prevents rendering of falsy values like 0 or empty string',
    patterns: [
      /\{\s*\w+(?:\.\w+)*\.length\s*&&\s*</g,
      /\{\s*\w+\s*&&\s*</g,
    ],
    staticConfidence: 'MEDIUM',
    antiPattern: {
      code: `function MessageList({ messages }) {
  return (
    <div>
      {messages.length && <List items={messages} />}
    </div>
  );
}`,
      explanation: 'When messages.length is 0, renders "0" instead of nothing',
    },
    bestPractice: {
      code: `function MessageList({ messages }) {
  return (
    <div>
      {messages.length > 0 ? <List items={messages} /> : null}
    </div>
  );
}`,
      explanation: 'Explicit boolean check - renders null when empty',
    },
    aiPromptContext: 'Check for && with values that could be falsy (0, "", false) instead of null/undefined',
    filePatterns: ['*.tsx', '*.jsx'],
    enabledByDefault: true,
  },
  {
    id: 'rendering-hoist-jsx',
    category: 'rendering',
    severity: 'LOW',
    name: 'Hoist Static JSX Elements',
    description: 'Extract static JSX outside components to avoid recreation',
    impact: 'Reduces object allocation and garbage collection',
    staticConfidence: 'LOW',
    antiPattern: {
      code: `function Card({ title, children }) {
  return (
    <div className="card">
      <div className="card-icon">
        <svg viewBox="0 0 24 24">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
        </svg>
      </div>
      <h2>{title}</h2>
      {children}
    </div>
  );
}`,
      explanation: 'SVG element recreated on every render',
    },
    bestPractice: {
      code: `const CardIcon = (
  <div className="card-icon">
    <svg viewBox="0 0 24 24">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
    </svg>
  </div>
);

function Card({ title, children }) {
  return (
    <div className="card">
      {CardIcon}
      <h2>{title}</h2>
      {children}
    </div>
  );
}`,
      explanation: 'Static JSX created once, reused across renders',
    },
    aiPromptContext: 'Look for complex static JSX (especially SVGs) inside components',
    filePatterns: ['*.tsx', '*.jsx'],
    enabledByDefault: false,
  },
  {
    id: 'rendering-content-visibility',
    category: 'rendering',
    severity: 'MEDIUM',
    name: 'Use content-visibility for Long Lists',
    description: 'Apply CSS content-visibility: auto for off-screen content',
    impact: 'Skips rendering of off-screen content, improving initial load',
    staticConfidence: 'LOW',
    antiPattern: {
      code: `function LongList({ items }) {
  return (
    <div className="list">
      {items.map(item => (
        <div key={item.id} className="list-item">
          {/* Complex content */}
        </div>
      ))}
    </div>
  );
}`,
      explanation: 'All items render even when off-screen',
    },
    bestPractice: {
      code: `function LongList({ items }) {
  return (
    <div className="list">
      {items.map(item => (
        <div 
          key={item.id} 
          className="list-item"
          style={{ contentVisibility: 'auto', containIntrinsicSize: '0 50px' }}
        >
          {/* Complex content */}
        </div>
      ))}
    </div>
  );
}`,
      explanation: 'Browser skips rendering off-screen items until scrolled into view',
    },
    aiPromptContext: 'For long lists (50+ items) where items have consistent height',
    filePatterns: ['*.tsx', '*.jsx'],
    enabledByDefault: true,
  },
  {
    id: 'rendering-hydration-mismatch',
    category: 'rendering',
    severity: 'HIGH',
    name: 'Prevent Hydration Mismatch Without Flickering',
    description: 'Use inline script for client-only data to avoid hydration mismatch',
    impact: 'Prevents hydration errors and UI flickering',
    patterns: [
      /typeof\s+window\s*!==?\s*['"]undefined['"]/g,
      /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{[\s\S]*?set\w+\s*\([^)]*(?:localStorage|navigator|window\.)[^)]*\)/g,
    ],
    staticConfidence: 'MEDIUM',
    antiPattern: {
      code: `function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');
  
  useEffect(() => {
    setTheme(localStorage.getItem('theme') || 'light');
  }, []); // Causes flash of wrong theme
  
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}`,
      explanation: 'Server renders "light", client hydrates with localStorage value - flash',
    },
    bestPractice: {
      code: `// In _document.tsx or layout.tsx <head>
<script dangerouslySetInnerHTML={{
  __html: \`
    (function() {
      var theme = localStorage.getItem('theme') || 'light';
      document.documentElement.setAttribute('data-theme', theme);
    })();
  \`
}} />

// In component
function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.getAttribute('data-theme') || 'light';
    }
    return 'light';
  });
  // No flash - theme is set before React hydrates
}`,
      explanation: 'Inline script runs before React, sets initial state correctly',
    },
    aiPromptContext: 'Look for useEffect that sets state from localStorage/cookies causing flash',
    filePatterns: ['*.tsx', '*.jsx'],
    enabledByDefault: true,
  },
  {
    id: 'rendering-suppress-hydration',
    category: 'rendering',
    severity: 'LOW',
    name: 'Suppress Expected Hydration Mismatches',
    description: 'Use suppressHydrationWarning for intentionally different content',
    impact: 'Prevents console warnings for expected mismatches',
    staticConfidence: 'LOW',
    antiPattern: {
      code: `function Timestamp({ date }) {
  return <time>{new Date(date).toLocaleString()}</time>;
  // Warning: Prop \`children\` did not match
}`,
      explanation: 'Server locale may differ from client - warning on every render',
    },
    bestPractice: {
      code: `function Timestamp({ date }) {
  return (
    <time suppressHydrationWarning>
      {new Date(date).toLocaleString()}
    </time>
  );
}`,
      explanation: 'Suppresses warning for expected mismatch - uses client value',
    },
    aiPromptContext: 'Use for locale-dependent content, timestamps, random values',
    filePatterns: ['*.tsx', '*.jsx'],
    enabledByDefault: false,
  },
  {
    id: 'rendering-svg-animate-wrapper',
    category: 'rendering',
    severity: 'LOW',
    name: 'Animate SVG Wrapper Instead of SVG',
    description: 'Wrap SVG in div and animate the wrapper for better performance',
    impact: 'CSS transforms on SVG are more expensive than on regular elements',
    staticConfidence: 'LOW',
    antiPattern: {
      code: `<svg 
  className="animate-spin" 
  viewBox="0 0 24 24"
>
  <circle cx="12" cy="12" r="10" />
</svg>`,
      explanation: 'Animating SVG element directly is slower',
    },
    bestPractice: {
      code: `<div className="animate-spin">
  <svg viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" />
  </svg>
</div>`,
      explanation: 'Wrapper element animates more efficiently',
    },
    aiPromptContext: 'Look for CSS transforms/animations applied directly to SVG elements',
    filePatterns: ['*.tsx', '*.jsx'],
    enabledByDefault: false,
  },
  {
    id: 'rendering-usetransition-loading',
    category: 'rendering',
    severity: 'MEDIUM',
    name: 'Prefer useTransition for Loading States',
    description: 'Use useTransition isPending instead of manual loading state',
    impact: 'Automatic loading state management, more responsive UI',
    patterns: [
      /const\s*\[\s*(?:isLoading|loading)\s*,\s*set(?:IsLoading|Loading)\s*\]\s*=\s*useState/g,
    ],
    staticConfidence: 'LOW',
    antiPattern: {
      code: `function SearchResults({ query }) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  
  const handleSearch = async () => {
    setLoading(true);
    const data = await fetchResults(query);
    setResults(data);
    setLoading(false);
  };
  
  return loading ? <Spinner /> : <List items={results} />;
}`,
      explanation: 'Manual loading state, input blocked during search',
    },
    bestPractice: {
      code: `function SearchResults({ query }) {
  const [isPending, startTransition] = useTransition();
  const [results, setResults] = useState([]);
  
  const handleSearch = () => {
    startTransition(async () => {
      const data = await fetchResults(query);
      setResults(data);
    });
  };
  
  return isPending ? <Spinner /> : <List items={results} />;
}`,
      explanation: 'Automatic loading state, UI stays responsive',
    },
    aiPromptContext: 'Look for manual loading boolean state that could use useTransition',
    filePatterns: ['*.tsx', '*.jsx'],
    enabledByDefault: true,
  },
];
