import type { ReactRule } from '../types';

export const ADVANCED_RULES: ReactRule[] = [
  {
    id: 'advanced-init-once',
    category: 'advanced',
    severity: 'LOW',
    name: 'Initialize App Once, Not Per Mount',
    description: 'Use module-level flag for one-time app initialization',
    impact: 'Prevents duplicate initialization in Strict Mode or remounts',
    patterns: [
      /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{[\s\S]*?(?:init|initialize|setup|configure)\w*\s*\(/g,
    ],
    staticConfidence: 'LOW',
    antiPattern: {
      code: `function App() {
  useEffect(() => {
    initializeAnalytics();
    initializeErrorTracking();
  }, []);
  
  return <MainContent />;
}`,
      explanation: 'In Strict Mode, effect runs twice - double initialization',
    },
    bestPractice: {
      code: `let initialized = false;

function initializeOnce() {
  if (initialized) return;
  initialized = true;
  
  initializeAnalytics();
  initializeErrorTracking();
}

function App() {
  useEffect(() => {
    initializeOnce();
  }, []);
  
  return <MainContent />;
}`,
      explanation: 'Module-level flag ensures initialization happens exactly once',
    },
    aiPromptContext: 'For global/app-level initialization that should only happen once per app load',
    filePatterns: ['*.tsx', '*.jsx'],
    enabledByDefault: true,
  },
  {
    id: 'advanced-event-handler-refs',
    category: 'advanced',
    severity: 'LOW',
    name: 'Store Event Handlers in Refs',
    description: 'Use refs for event handlers to avoid effect re-runs',
    impact: 'Prevents unnecessary effect cleanup/setup cycles',
    staticConfidence: 'LOW',
    antiPattern: {
      code: `function useInterval(callback, delay) {
  useEffect(() => {
    const id = setInterval(callback, delay);
    return () => clearInterval(id);
  }, [callback, delay]); // Restarts interval when callback changes
}`,
      explanation: 'Effect re-runs when callback changes, restarting interval',
    },
    bestPractice: {
      code: `function useInterval(callback, delay) {
  const callbackRef = useRef(callback);
  
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  
  useEffect(() => {
    const id = setInterval(() => callbackRef.current(), delay);
    return () => clearInterval(id);
  }, [delay]); // Only restarts when delay changes
}`,
      explanation: 'Ref stores latest callback, interval only restarts for delay change',
    },
    aiPromptContext: 'For event handlers passed to effects that shouldn\'t restart the effect',
    filePatterns: ['*.tsx', '*.jsx', '*.ts', '*.js'],
    enabledByDefault: true,
  },
  {
    id: 'advanced-use-latest',
    category: 'advanced',
    severity: 'LOW',
    name: 'useLatest for Stable Callback Refs',
    description: 'Create a custom useLatest hook for stable references to latest values',
    impact: 'Simplifies common pattern of keeping refs in sync with values',
    staticConfidence: 'LOW',
    antiPattern: {
      code: `function MyComponent({ onClick }) {
  const onClickRef = useRef(onClick);
  
  useEffect(() => {
    onClickRef.current = onClick;
  }, [onClick]);
  
  useEffect(() => {
    element.addEventListener('click', () => onClickRef.current());
    // ...
  }, []);
}`,
      explanation: 'Boilerplate repeated for each ref that needs to stay current',
    },
    bestPractice: {
      code: `function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

function MyComponent({ onClick }) {
  const onClickRef = useLatest(onClick);
  
  useEffect(() => {
    element.addEventListener('click', () => onClickRef.current());
    // ...
  }, []);
}`,
      explanation: 'Reusable hook encapsulates the ref-sync pattern',
    },
    aiPromptContext: 'Look for repeated patterns of useRef + useEffect to sync ref with value',
    filePatterns: ['*.tsx', '*.jsx', '*.ts', '*.js'],
    enabledByDefault: false,
  },
  {
    id: 'advanced-activity-show-hide',
    category: 'advanced',
    severity: 'LOW',
    name: 'Use Activity Component for Show/Hide',
    description: 'Use React Activity (experimental) to preserve state of hidden components',
    impact: 'Avoids remounting/state loss when toggling component visibility',
    staticConfidence: 'LOW',
    antiPattern: {
      code: `function Tabs({ activeTab }) {
  return (
    <div>
      {activeTab === 'home' && <HomeTab />}
      {activeTab === 'settings' && <SettingsTab />}
    </div>
  );
}`,
      explanation: 'Inactive tabs unmount, losing their state',
    },
    bestPractice: {
      code: `import { unstable_Activity as Activity } from 'react';

function Tabs({ activeTab }) {
  return (
    <div>
      <Activity mode={activeTab === 'home' ? 'visible' : 'hidden'}>
        <HomeTab />
      </Activity>
      <Activity mode={activeTab === 'settings' ? 'visible' : 'hidden'}>
        <SettingsTab />
      </Activity>
    </div>
  );
}`,
      explanation: 'Hidden tabs preserve state, just hidden from view',
    },
    aiPromptContext: 'Activity is experimental in React 19+. Alternative: keep all mounted with CSS display:none',
    filePatterns: ['*.tsx', '*.jsx'],
    enabledByDefault: false,
  },
];
