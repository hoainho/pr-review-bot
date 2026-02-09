import type { ReactRule } from '../types';

export const CLIENT_SIDE_RULES: ReactRule[] = [
  {
    id: 'client-swr-dedup',
    category: 'client-side',
    severity: 'MEDIUM',
    name: 'Use SWR for Automatic Deduplication',
    description: 'SWR provides request deduplication, caching, and revalidation',
    impact: 'Eliminates duplicate client-side fetches across component instances',
    patterns: [
      /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{[\s\S]*?fetch\s*\([^)]+\)[\s\S]*?\.then[\s\S]*?\}\s*,\s*\[\s*\]\s*\)/g,
    ],
    staticConfidence: 'MEDIUM',
    antiPattern: {
      code: `function UserList() {
  const [users, setUsers] = useState([]);
  useEffect(() => {
    fetch('/api/users')
      .then(r => r.json())
      .then(setUsers);
  }, []);
  return <div>{users.map(u => u.name)}</div>;
}`,
      explanation: 'Each instance fetches independently - no deduplication',
    },
    bestPractice: {
      code: `import useSWR from 'swr';

function UserList() {
  const { data: users } = useSWR('/api/users', fetcher);
  return <div>{users?.map(u => u.name)}</div>;
}`,
      explanation: 'Multiple instances share one request - automatic deduplication',
    },
    aiPromptContext: 'Check if fetch is for data that could benefit from caching and revalidation',
    references: ['https://swr.vercel.app'],
    filePatterns: ['*.tsx', '*.jsx'],
    enabledByDefault: true,
  },
  {
    id: 'client-event-listeners',
    category: 'client-side',
    severity: 'LOW',
    name: 'Deduplicate Global Event Listeners',
    description: 'Share global event listeners across component instances',
    impact: 'N components = 1 listener instead of N listeners',
    patterns: [
      /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{[\s\S]*?(?:window|document)\.addEventListener[\s\S]*?\}\s*,/g,
    ],
    staticConfidence: 'LOW',
    antiPattern: {
      code: `function useKeyboardShortcut(key, callback) {
  useEffect(() => {
    const handler = (e) => {
      if (e.metaKey && e.key === key) callback();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [key, callback]);
}`,
      explanation: 'Each hook instance registers its own listener',
    },
    bestPractice: {
      code: `import useSWRSubscription from 'swr/subscription';

const keyCallbacks = new Map();

function useKeyboardShortcut(key, callback) {
  useEffect(() => {
    if (!keyCallbacks.has(key)) keyCallbacks.set(key, new Set());
    keyCallbacks.get(key).add(callback);
    return () => {
      keyCallbacks.get(key)?.delete(callback);
      if (keyCallbacks.get(key)?.size === 0) keyCallbacks.delete(key);
    };
  }, [key, callback]);

  useSWRSubscription('global-keydown', () => {
    const handler = (e) => {
      if (e.metaKey && keyCallbacks.has(e.key)) {
        keyCallbacks.get(e.key).forEach(cb => cb());
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });
}`,
      explanation: 'Single listener shared across all instances',
    },
    filePatterns: ['*.tsx', '*.jsx', '*.ts', '*.js'],
    enabledByDefault: false,
  },
  {
    id: 'client-passive-event-listeners',
    category: 'client-side',
    severity: 'MEDIUM',
    name: 'Use Passive Event Listeners for Scrolling',
    description: 'Add { passive: true } to touch/wheel listeners for smooth scrolling',
    impact: 'Eliminates scroll delay caused by waiting for preventDefault check',
    patterns: [
      /addEventListener\s*\(\s*['"](?:touchstart|touchmove|wheel|scroll)['"]\s*,\s*\w+\s*\)/g,
    ],
    staticConfidence: 'HIGH',
    antiPattern: {
      code: `useEffect(() => {
  const handleWheel = (e) => console.log(e.deltaY);
  document.addEventListener('wheel', handleWheel);
  return () => document.removeEventListener('wheel', handleWheel);
}, []);`,
      explanation: 'Browser waits to check if preventDefault() is called - scroll delay',
    },
    bestPractice: {
      code: `useEffect(() => {
  const handleWheel = (e) => console.log(e.deltaY);
  document.addEventListener('wheel', handleWheel, { passive: true });
  return () => document.removeEventListener('wheel', handleWheel);
}, []);`,
      explanation: 'Browser knows preventDefault won\'t be called - immediate scrolling',
    },
    aiPromptContext: 'Use passive when NOT calling preventDefault(). Not for custom gestures/zoom.',
    filePatterns: ['*.tsx', '*.jsx', '*.ts', '*.js'],
    enabledByDefault: true,
  },
  {
    id: 'client-localstorage-schema',
    category: 'client-side',
    severity: 'MEDIUM',
    name: 'Version and Minimize localStorage Data',
    description: 'Add version prefix to keys and store only needed fields',
    impact: 'Prevents schema conflicts and reduces storage size',
    patterns: [
      /localStorage\.setItem\s*\(\s*['"][^'"]+['"]\s*,\s*JSON\.stringify\s*\(\s*\w+\s*\)\s*\)/g,
    ],
    staticConfidence: 'LOW',
    antiPattern: {
      code: `localStorage.setItem('userConfig', JSON.stringify(fullUserObject));
const data = localStorage.getItem('userConfig');`,
      explanation: 'No version, stores everything, no error handling',
    },
    bestPractice: {
      code: `const VERSION = 'v2';

function saveConfig(config) {
  try {
    localStorage.setItem(\`userConfig:\${VERSION}\`, JSON.stringify(config));
  } catch {
    // Handles incognito, quota exceeded, disabled
  }
}

function loadConfig() {
  try {
    const data = localStorage.getItem(\`userConfig:\${VERSION}\`);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}`,
      explanation: 'Versioned, minimal fields, proper error handling',
    },
    aiPromptContext: 'Check if storing entire objects when only subset is needed',
    filePatterns: ['*.tsx', '*.jsx', '*.ts', '*.js'],
    enabledByDefault: true,
  },
];
