import type { ReactRule } from '../types';

export const WATERFALLS_RULES: ReactRule[] = [
  {
    id: 'async-parallel',
    category: 'waterfalls',
    severity: 'CRITICAL',
    name: 'Use Promise.all() for Independent Operations',
    description: 'Sequential await statements for independent operations create request waterfalls',
    impact: '2-10x slower execution due to sequential network requests instead of parallel',
    patterns: [
      /await\s+\w+\s*\([^)]*\)\s*;[\s\n]*await\s+\w+\s*\(/g,
      /const\s+\w+\s*=\s*await\s+\w+\([^)]*\)\s*;[\s\n]*const\s+\w+\s*=\s*await\s+\w+\(/g,
    ],
    staticConfidence: 'MEDIUM',
    antiPattern: {
      code: `const user = await fetchUser();
const posts = await fetchPosts();
const comments = await fetchComments();`,
      explanation: 'Three sequential network requests - total time = sum of all requests',
    },
    bestPractice: {
      code: `const [user, posts, comments] = await Promise.all([
  fetchUser(),
  fetchPosts(),
  fetchComments()
]);`,
      explanation: 'Parallel execution - total time = slowest request only',
    },
    aiPromptContext: 'Check if the awaited operations are truly independent (no data dependencies between them)',
    references: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all'],
    filePatterns: ['*.ts', '*.tsx', '*.js', '*.jsx'],
    enabledByDefault: true,
  },
  {
    id: 'async-defer-await',
    category: 'waterfalls',
    severity: 'HIGH',
    name: 'Defer Await Until Needed',
    description: 'Moving await into conditional branches avoids blocking unused code paths',
    impact: 'Unnecessary waiting when the fetched data may not be used',
    patterns: [
      /const\s+\w+\s*=\s*await\s+\w+\([^)]*\)\s*;[\s\n]*if\s*\([^)]*\)\s*\{[\s\n]*return/g,
    ],
    staticConfidence: 'MEDIUM',
    antiPattern: {
      code: `async function handleRequest(skipProcessing: boolean) {
  const userData = await fetchUserData(); // Always waits
  if (skipProcessing) {
    return { skipped: true }; // userData not used
  }
  return processUserData(userData);
}`,
      explanation: 'fetchUserData() runs even when skipProcessing is true',
    },
    bestPractice: {
      code: `async function handleRequest(skipProcessing: boolean) {
  if (skipProcessing) {
    return { skipped: true }; // Returns immediately
  }
  const userData = await fetchUserData(); // Fetch only when needed
  return processUserData(userData);
}`,
      explanation: 'Fetch only when the data will actually be used',
    },
    aiPromptContext: 'Verify if the early return branch actually needs the awaited data',
    filePatterns: ['*.ts', '*.tsx', '*.js', '*.jsx'],
    enabledByDefault: true,
  },
  {
    id: 'async-api-routes',
    category: 'waterfalls',
    severity: 'CRITICAL',
    name: 'Prevent Waterfall Chains in API Routes',
    description: 'Start independent promises early in API routes, await late',
    impact: '2-10x improvement by parallelizing independent operations',
    patterns: [
      /export\s+async\s+function\s+(?:GET|POST|PUT|DELETE|PATCH)\s*\([^)]*\)\s*\{[\s\S]*?const\s+\w+\s*=\s*await[\s\S]*?const\s+\w+\s*=\s*await/g,
    ],
    staticConfidence: 'MEDIUM',
    antiPattern: {
      code: `export async function GET(request: Request) {
  const session = await auth();
  const config = await fetchConfig(); // Waits for auth to complete
  const data = await fetchData(session.user.id);
  return Response.json({ data, config });
}`,
      explanation: 'config waits for auth, data waits for both - waterfall chain',
    },
    bestPractice: {
      code: `export async function GET(request: Request) {
  const sessionPromise = auth();
  const configPromise = fetchConfig(); // Starts immediately
  const session = await sessionPromise;
  const [config, data] = await Promise.all([
    configPromise,
    fetchData(session.user.id)
  ]);
  return Response.json({ data, config });
}`,
      explanation: 'auth and config start in parallel, data starts as soon as session is ready',
    },
    aiPromptContext: 'This is for Next.js API routes. Check if operations have real dependencies.',
    filePatterns: ['**/api/**/*.ts', '**/route.ts', '**/route.tsx'],
    enabledByDefault: true,
  },
  {
    id: 'async-suspense-boundaries',
    category: 'waterfalls',
    severity: 'HIGH',
    name: 'Strategic Suspense Boundaries',
    description: 'Use Suspense boundaries to show wrapper UI while data loads',
    impact: 'Faster initial paint - shell renders immediately while data streams in',
    staticConfidence: 'LOW',
    antiPattern: {
      code: `async function Page() {
  const data = await fetchData(); // Blocks entire page
  return (
    <div>
      <Sidebar />
      <Header />
      <DataDisplay data={data} />
      <Footer />
    </div>
  );
}`,
      explanation: 'Entire layout waits for data even though only DataDisplay needs it',
    },
    bestPractice: {
      code: `function Page() {
  return (
    <div>
      <Sidebar />
      <Header />
      <Suspense fallback={<Skeleton />}>
        <DataDisplay /> {/* Fetches inside */}
      </Suspense>
      <Footer />
    </div>
  );
}

async function DataDisplay() {
  const data = await fetchData(); // Only blocks this component
  return <div>{data.content}</div>;
}`,
      explanation: 'Shell renders immediately, DataDisplay streams in when ready',
    },
    aiPromptContext: 'For React Server Components. Check if data is needed for layout or SEO-critical content.',
    filePatterns: ['*.tsx', '*.jsx'],
    enabledByDefault: true,
  },
  {
    id: 'async-dependencies',
    category: 'waterfalls',
    severity: 'HIGH',
    name: 'Dependency-Based Parallelization',
    description: 'Use Promise patterns or better-all for operations with partial dependencies',
    impact: '2-10x improvement by maximizing parallelism for dependent operations',
    patterns: [
      /const\s+\[\s*\w+\s*,\s*\w+\s*\]\s*=\s*await\s+Promise\.all\(\[[\s\S]*?\]\)[\s\n]*const\s+\w+\s*=\s*await/g,
    ],
    staticConfidence: 'LOW',
    antiPattern: {
      code: `const [user, config] = await Promise.all([
  fetchUser(),
  fetchConfig()
]);
const profile = await fetchProfile(user.id); // Waits for both, only needs user`,
      explanation: 'profile waits for config unnecessarily',
    },
    bestPractice: {
      code: `const userPromise = fetchUser();
const profilePromise = userPromise.then(user => fetchProfile(user.id));
const [user, config, profile] = await Promise.all([
  userPromise,
  fetchConfig(), // Runs in parallel with user
  profilePromise // Starts as soon as user is ready
]);`,
      explanation: 'config and user run in parallel, profile starts immediately when user resolves',
    },
    aiPromptContext: 'Check the actual data dependencies between promises',
    references: ['https://github.com/shuding/better-all'],
    filePatterns: ['*.ts', '*.tsx', '*.js', '*.jsx'],
    enabledByDefault: true,
  },
];
