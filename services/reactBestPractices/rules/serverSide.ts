import type { ReactRule } from '../types';

export const SERVER_SIDE_RULES: ReactRule[] = [
  {
    id: 'server-auth-actions',
    category: 'server-side',
    severity: 'CRITICAL',
    name: 'Authenticate Server Actions Like API Routes',
    description: 'Server Actions are public endpoints - always verify auth inside each action',
    impact: 'Security vulnerability - unauthorized access to server mutations',
    patterns: [
      /['"]use server['"]\s*;?[\s\n]*export\s+async\s+function\s+\w+\s*\([^)]*\)\s*\{(?![\s\S]*(?:verifySession|auth\(\)|getServerSession|validateToken|checkAuth))/g,
    ],
    staticConfidence: 'MEDIUM',
    antiPattern: {
      code: `'use server'

export async function deleteUser(userId: string) {
  // Anyone can call this! No auth check
  await db.user.delete({ where: { id: userId } });
  return { success: true };
}`,
      explanation: 'Server Action exposed as public endpoint without authentication',
    },
    bestPractice: {
      code: `'use server'

import { verifySession } from '@/lib/auth';

export async function deleteUser(userId: string) {
  const session = await verifySession();
  
  if (!session) {
    throw new Error('Unauthorized');
  }
  
  if (session.user.role !== 'admin' && session.user.id !== userId) {
    throw new Error('Forbidden');
  }
  
  await db.user.delete({ where: { id: userId } });
  return { success: true };
}`,
      explanation: 'Auth check inside the action - cannot be bypassed',
    },
    aiPromptContext: 'Server Actions are publicly accessible HTTP endpoints. Auth must be checked INSIDE each action.',
    references: ['https://nextjs.org/docs/app/guides/authentication'],
    filePatterns: ['**/actions/**/*.ts', '**/actions.ts', '**/*Actions.ts'],
    enabledByDefault: true,
  },
  {
    id: 'server-cache-react',
    category: 'server-side',
    severity: 'MEDIUM',
    name: 'Per-Request Deduplication with React.cache()',
    description: 'Use React.cache() for server-side request deduplication',
    impact: 'Eliminates duplicate database/API calls within a single request',
    patterns: [
      /export\s+(?:const|async\s+function)\s+get\w+\s*=?\s*(?:async\s*)?\([^)]*\)\s*(?:=>)?\s*\{[\s\S]*?(?:db\.|prisma\.|fetch\()[^}]+\}/g,
    ],
    staticConfidence: 'LOW',
    antiPattern: {
      code: `export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return await db.user.findUnique({
    where: { id: session.user.id }
  });
}`,
      explanation: 'Called from multiple components = multiple DB queries per request',
    },
    bestPractice: {
      code: `import { cache } from 'react';

export const getCurrentUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return null;
  return await db.user.findUnique({
    where: { id: session.user.id }
  });
});`,
      explanation: 'Multiple calls within same request execute query only once',
    },
    aiPromptContext: 'React.cache() only works within a single request. For cross-request caching, use LRU cache.',
    references: ['https://react.dev/reference/react/cache'],
    filePatterns: ['*.ts', '*.tsx'],
    enabledByDefault: true,
  },
  {
    id: 'server-serialization',
    category: 'server-side',
    severity: 'HIGH',
    name: 'Minimize Serialization at RSC Boundaries',
    description: 'Only pass fields that client components actually use',
    impact: 'Reduces HTML payload size and page load time',
    staticConfidence: 'LOW',
    antiPattern: {
      code: `async function Page() {
  const user = await fetchUser();  // 50 fields
  return <Profile user={user} />;
}

'use client'
function Profile({ user }) {
  return <div>{user.name}</div>;  // uses 1 field
}`,
      explanation: 'All 50 fields serialized and sent to client, only 1 used',
    },
    bestPractice: {
      code: `async function Page() {
  const user = await fetchUser();
  return <Profile name={user.name} />;  // Only send what's needed
}

'use client'
function Profile({ name }) {
  return <div>{name}</div>;
}`,
      explanation: 'Only 1 field serialized - minimal payload',
    },
    aiPromptContext: 'RSC boundaries serialize all props to HTML. Check if passing unnecessary data.',
    filePatterns: ['*.tsx', '*.jsx'],
    enabledByDefault: true,
  },
  {
    id: 'server-parallel-fetching',
    category: 'server-side',
    severity: 'CRITICAL',
    name: 'Parallel Data Fetching with Component Composition',
    description: 'Restructure RSC tree to parallelize data fetching',
    impact: 'Eliminates server-side waterfalls between components',
    staticConfidence: 'LOW',
    antiPattern: {
      code: `export default async function Page() {
  const header = await fetchHeader();
  return (
    <div>
      <div>{header}</div>
      <Sidebar />  {/* Waits for header fetch */}
    </div>
  );
}

async function Sidebar() {
  const items = await fetchSidebarItems();
  return <nav>{items.map(renderItem)}</nav>;
}`,
      explanation: 'Sidebar fetch waits for Page\'s header fetch to complete',
    },
    bestPractice: {
      code: `async function Header() {
  const data = await fetchHeader();
  return <div>{data}</div>;
}

async function Sidebar() {
  const items = await fetchSidebarItems();
  return <nav>{items.map(renderItem)}</nav>;
}

export default function Page() {
  return (
    <div>
      <Header />  {/* Both fetch in parallel */}
      <Sidebar />
    </div>
  );
}`,
      explanation: 'Header and Sidebar fetch simultaneously - no waterfall',
    },
    aiPromptContext: 'React Server Components in the same tree level fetch in parallel',
    filePatterns: ['*.tsx', '*.jsx'],
    enabledByDefault: true,
  },
  {
    id: 'server-after-nonblocking',
    category: 'server-side',
    severity: 'MEDIUM',
    name: 'Use after() for Non-Blocking Operations',
    description: 'Schedule logging/analytics to run after response is sent',
    impact: 'Faster response times - non-critical work doesn\'t block response',
    patterns: [
      /export\s+async\s+function\s+(?:GET|POST|PUT|DELETE|PATCH)\s*\([^)]*\)\s*\{[\s\S]*?await\s+(?:log|analytics|track|record|audit)/gi,
    ],
    staticConfidence: 'MEDIUM',
    antiPattern: {
      code: `export async function POST(request: Request) {
  await updateDatabase(request);
  await logUserAction({ userAgent: request.headers.get('user-agent') });
  return Response.json({ status: 'success' });
}`,
      explanation: 'Logging blocks the response - user waits unnecessarily',
    },
    bestPractice: {
      code: `import { after } from 'next/server';

export async function POST(request: Request) {
  await updateDatabase(request);
  
  after(async () => {
    await logUserAction({ userAgent: request.headers.get('user-agent') });
  });
  
  return Response.json({ status: 'success' });
}`,
      explanation: 'Response sent immediately, logging runs in background',
    },
    aiPromptContext: 'Next.js after() runs code after response is sent. Good for logging, analytics, cleanup.',
    references: ['https://nextjs.org/docs/app/api-reference/functions/after'],
    filePatterns: ['**/api/**/*.ts', '**/route.ts'],
    enabledByDefault: true,
  },
  {
    id: 'server-dedup-props',
    category: 'server-side',
    severity: 'LOW',
    name: 'Avoid Duplicate Serialization in RSC Props',
    description: 'RSC deduplicates by reference - don\'t transform data that will be passed as multiple props',
    impact: 'Reduces serialization overhead and payload size',
    staticConfidence: 'LOW',
    antiPattern: {
      code: `<ClientList 
  usernames={usernames} 
  usernamesOrdered={usernames.toSorted()} 
/>`,
      explanation: 'toSorted() creates new array - serializes data twice',
    },
    bestPractice: {
      code: `<ClientList usernames={usernames} />

// In client component:
'use client'
const sorted = useMemo(() => [...usernames].sort(), [usernames]);`,
      explanation: 'Send once, transform in client - deduplication preserved',
    },
    aiPromptContext: 'Operations like .toSorted(), .filter(), .map() create new references, breaking deduplication',
    filePatterns: ['*.tsx', '*.jsx'],
    enabledByDefault: false,
  },
];
