import type { ReactRule } from '../types';

const HEAVY_PACKAGES = [
  'lucide-react',
  '@mui/material',
  '@mui/icons-material',
  '@tabler/icons-react',
  'react-icons',
  '@headlessui/react',
  '@radix-ui/react-',
  'lodash',
  'ramda',
  'date-fns',
  'moment',
  'rxjs',
  'react-use',
];

const ANALYTICS_PACKAGES = [
  '@vercel/analytics',
  '@sentry/',
  'posthog-js',
  '@segment/',
  'mixpanel-browser',
  '@amplitude/',
  'hotjar',
  '@datadog/',
  'newrelic',
  '@google-analytics',
  'gtag',
];

export const BUNDLE_SIZE_RULES: ReactRule[] = [
  {
    id: 'bundle-barrel-imports',
    category: 'bundle-size',
    severity: 'CRITICAL',
    name: 'Avoid Barrel File Imports',
    description: 'Import directly from source files instead of barrel files (index.js)',
    impact: '200-800ms import cost, 15-70% slower dev boot, 28% slower builds',
    patterns: [
      /import\s*\{[^}]+\}\s*from\s*['"]lucide-react['"]/g,
      /import\s*\{[^}]+\}\s*from\s*['"]@mui\/material['"]/g,
      /import\s*\{[^}]+\}\s*from\s*['"]@mui\/icons-material['"]/g,
      /import\s*\{[^}]+\}\s*from\s*['"]react-icons(?:\/[^'"]+)?['"]/g,
      /import\s*\{[^}]+\}\s*from\s*['"]lodash['"]/g,
      /import\s*\{[^}]+\}\s*from\s*['"]date-fns['"]/g,
    ],
    staticConfidence: 'HIGH',
    antiPattern: {
      code: `import { Check, X, Menu } from 'lucide-react';
import { Button, TextField } from '@mui/material';`,
      explanation: 'Loads entire library (1000+ modules) just to use 2-3 components',
    },
    bestPractice: {
      code: `import Check from 'lucide-react/dist/esm/icons/check';
import X from 'lucide-react/dist/esm/icons/x';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';`,
      explanation: 'Loads only the specific modules needed (~2KB vs ~1MB)',
    },
    aiPromptContext: `Heavy packages: ${HEAVY_PACKAGES.join(', ')}. Check if using Next.js optimizePackageImports.`,
    references: ['https://vercel.com/blog/how-we-optimized-package-imports-in-next-js'],
    filePatterns: ['*.ts', '*.tsx', '*.js', '*.jsx'],
    enabledByDefault: true,
  },
  {
    id: 'bundle-dynamic-imports',
    category: 'bundle-size',
    severity: 'CRITICAL',
    name: 'Dynamic Imports for Heavy Components',
    description: 'Use next/dynamic or React.lazy for large components not needed on initial render',
    impact: 'Directly affects Time to Interactive (TTI) and Largest Contentful Paint (LCP)',
    patterns: [
      /import\s+(?:\{[^}]*\}|\w+)\s+from\s*['"](monaco-editor|@monaco-editor|ace-editor|codemirror|@uiw\/react-codemirror|chart\.js|recharts|@nivo|victory|three|@react-three|mapbox-gl|react-map-gl|leaflet|@deck\.gl|pdf-lib|react-pdf|@react-pdf)['"]/g,
    ],
    staticConfidence: 'HIGH',
    antiPattern: {
      code: `import { MonacoEditor } from './monaco-editor';

function CodePanel({ code }: { code: string }) {
  return <MonacoEditor value={code} />;
}`,
      explanation: 'Monaco (~300KB) bundles with main chunk even if not immediately needed',
    },
    bestPractice: {
      code: `import dynamic from 'next/dynamic';

const MonacoEditor = dynamic(
  () => import('./monaco-editor').then(m => m.MonacoEditor),
  { ssr: false }
);

function CodePanel({ code }: { code: string }) {
  return <MonacoEditor value={code} />;
}`,
      explanation: 'Monaco loads on demand, not blocking initial page load',
    },
    aiPromptContext: 'Heavy components: editors, charts, maps, 3D, PDF. Check if component is above the fold.',
    filePatterns: ['*.ts', '*.tsx', '*.js', '*.jsx'],
    enabledByDefault: true,
  },
  {
    id: 'bundle-defer-third-party',
    category: 'bundle-size',
    severity: 'HIGH',
    name: 'Defer Non-Critical Third-Party Libraries',
    description: 'Load analytics, logging, and error tracking after hydration',
    impact: 'Reduces initial bundle size, faster Time to Interactive',
    patterns: [
      /import\s+(?:\{[^}]*\}|\w+)\s+from\s*['"]@vercel\/analytics(?:\/react)?['"]/g,
      /import\s+(?:\{[^}]*\}|\w+)\s+from\s*['"]@sentry\/[^'"]+['"]/g,
      /import\s+(?:\{[^}]*\}|\w+)\s+from\s*['"]posthog-js['"]/g,
      /import\s+(?:\{[^}]*\}|\w+)\s+from\s*['"]mixpanel-browser['"]/g,
    ],
    staticConfidence: 'MEDIUM',
    antiPattern: {
      code: `import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}`,
      explanation: 'Analytics blocks initial bundle even though it doesn\'t affect user interaction',
    },
    bestPractice: {
      code: `import dynamic from 'next/dynamic';

const Analytics = dynamic(
  () => import('@vercel/analytics/react').then(m => m.Analytics),
  { ssr: false }
);

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}`,
      explanation: 'Analytics loads after hydration, not blocking initial render',
    },
    aiPromptContext: `Analytics packages: ${ANALYTICS_PACKAGES.join(', ')}. These don't block user interaction.`,
    filePatterns: ['*.ts', '*.tsx', '*.js', '*.jsx'],
    enabledByDefault: true,
  },
  {
    id: 'bundle-conditional',
    category: 'bundle-size',
    severity: 'MEDIUM',
    name: 'Conditional Module Loading',
    description: 'Load large data or modules only when a feature is activated',
    impact: 'Reduces bundle size by loading heavy assets on demand',
    staticConfidence: 'LOW',
    antiPattern: {
      code: `import { animationFrames } from './animation-frames'; // 500KB

function AnimationPlayer({ enabled }) {
  if (!enabled) return null;
  return <Canvas frames={animationFrames} />;
}`,
      explanation: 'animationFrames always loaded even when feature is disabled',
    },
    bestPractice: {
      code: `function AnimationPlayer({ enabled, setEnabled }) {
  const [frames, setFrames] = useState(null);

  useEffect(() => {
    if (enabled && !frames) {
      import('./animation-frames')
        .then(mod => setFrames(mod.frames))
        .catch(() => setEnabled(false));
    }
  }, [enabled, frames, setEnabled]);

  if (!frames) return <Skeleton />;
  return <Canvas frames={frames} />;
}`,
      explanation: 'Heavy data loads only when feature is activated',
    },
    aiPromptContext: 'Check for large static imports that could be dynamically loaded based on feature flags or user actions',
    filePatterns: ['*.ts', '*.tsx', '*.js', '*.jsx'],
    enabledByDefault: true,
  },
  {
    id: 'bundle-preload',
    category: 'bundle-size',
    severity: 'MEDIUM',
    name: 'Preload Based on User Intent',
    description: 'Preload heavy bundles on hover/focus to reduce perceived latency',
    impact: 'Reduces perceived load time for dynamic imports',
    staticConfidence: 'LOW',
    antiPattern: {
      code: `function EditorButton({ onClick }) {
  return <button onClick={onClick}>Open Editor</button>;
}`,
      explanation: 'Editor bundle loads only after click - user sees loading state',
    },
    bestPractice: {
      code: `function EditorButton({ onClick }) {
  const preload = () => {
    if (typeof window !== 'undefined') {
      void import('./monaco-editor');
    }
  };

  return (
    <button
      onMouseEnter={preload}
      onFocus={preload}
      onClick={onClick}
    >
      Open Editor
    </button>
  );
}`,
      explanation: 'Editor preloads on hover, ready by the time user clicks',
    },
    aiPromptContext: 'Look for buttons/links that trigger heavy dynamic imports',
    filePatterns: ['*.tsx', '*.jsx'],
    enabledByDefault: true,
  },
];
