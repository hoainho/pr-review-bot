# AGENTS.md - Gear PR Review

AI coding agent guidelines for the Gear PR Review codebase.

## Project Overview

AI-powered code review tool with GitHub integration, Jira/Confluence context, and multi-model AI support (Gemini, Claude, GPT). React 19 + TypeScript + Vite frontend.

## Build & Run Commands

```bash
npm run dev          # Start dev server (port 3000)
npm run dev:prod     # Start dev server in production mode
npm run build        # Runs: npm run test && vite build
npm run preview      # Preview production build (port 4173)
```

## Testing

Uses **Vitest** with **happy-dom** environment. Husky runs `npm test` before every commit.

```bash
npm run test              # Run all tests (single run)
npm run test:watch        # Watch mode
npm run test:coverage     # With coverage
npm run test:ui           # Interactive UI

# Run single test file
npx vitest run tests/unit/githubService.test.ts

# Run tests matching pattern
npx vitest run -t "parseGitHubUrl"
```

### Test Structure

```
tests/
├── setup.ts           # Global setup, mocks fetch, cleanup
├── unit/              # Unit tests for services/components
└── integration/       # Integration tests
```

### Test Patterns

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ServiceName', () => {
  beforeEach(() => { vi.resetAllMocks(); });
  it('should do something specific', () => { /* Arrange, Act, Assert */ });
});
```

## Code Style Guidelines

### TypeScript Configuration

- **Target**: ES2022
- **Module**: ESNext with bundler resolution
- **Strict mode**: NOT enabled (be careful with null checks)
- Path alias: `@/*` maps to project root

### Import Organization

```typescript
// 1. React and core libraries
import React, { useState, useEffect, useCallback } from 'react';
// 2. External packages
import { GoogleGenAI, Type } from "@google/genai";
import { Check, X, Loader2 } from 'lucide-react';
// 3. Internal services (relative paths)
import { analyzeDiff } from './services/aiService';
import { fetchPrDiff, parseGitHubUrl } from './services/githubService';
// 4. Types (can be mixed with services or separate)
import { PRIssue, Severity, BugType } from './types';
import type { GitHubMCPContext } from './services/githubMCPContext';
// 5. Components
import { ReviewTerminal } from './components/ReviewTerminal';
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files (components) | PascalCase.tsx | `RequirementTooltip.tsx` |
| Files (services) | camelCase.ts | `githubService.ts`, `aiService.ts` |
| Files (tests) | camelCase.test.ts | `githubService.test.ts` |
| Functions | camelCase | `fetchPrDiff`, `parseGitHubUrl` |
| React Components | PascalCase | `ReviewTerminal`, `RequirementTooltip` |
| Interfaces/Types | PascalCase | `PRIssue`, `ModelConfig` |
| Enums | PascalCase | `Severity`, `BugType` |
| Enum values | SCREAMING_SNAKE | `Severity.HIGH`, `BugType.RACE_CONDITION` |
| Constants | SCREAMING_SNAKE | `GITHUB_API_BASE`, `MAX_CONCURRENT_REQUESTS` |

### Type Patterns

```typescript
// Interfaces for object shapes
export interface PRIssue {
  id?: string;
  bug_description: string;
  severity: Severity;
}

// Enums for fixed sets of values
export enum Severity { HIGH = 'HIGH', MEDIUM = 'MEDIUM', LOW = 'LOW', CRITICAL = 'CRITICAL' }

// Type for unions/aliases
export type ModelProvider = 'antigravity' | 'gemini' | 'opencode';

// Use `type` imports for types only
import type { GitHubMCPContext } from './services/githubMCPContext';
```

### Error Handling

```typescript
try {
  const response = await fetch(url, options);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Failed to fetch: ${errorData.message || response.statusText}`);
  }
  return await response.json();
} catch (err) {
  console.error('Operation failed:', err);
  throw err;
}

// Null-safe extraction pattern (strict mode is OFF)
const description = ticket.description || 'No description provided';
const preview = typeof description === 'string' 
  ? description.substring(0, 200) 
  : String(description).substring(0, 200);
```

## Project Structure

```
gear-pr-review/
├── App.tsx              # Main app (large, ~2000 lines)
├── index.tsx            # Entry point with providers
├── types.ts             # All interfaces/enums
├── services/            # Business logic (aiService, githubService, etc.)
├── components/          # React components
├── contexts/            # React contexts (AuthContext)
└── tests/               # Vitest tests (unit/, integration/)
```

## Key Patterns

**Services** export named functions (not default exports):
```typescript
export const parseGitHubUrl = (url: string): GitHubPrInfo | null => { ... };
export const fetchPrDiff = async (...) => { ... };
```

**Configuration objects** for settings:
```typescript
const CHUNK_CONFIG = { MAX_FILES_PER_CHUNK: 20, MAX_LINES_PER_CHUNK: 1200, DELAY_BETWEEN_CHUNKS_MS: 1000 };
```

**Styling**: Tailwind CSS with `dark:` prefixes for dark mode

## Important Notes for AI Agents

1. **Tests must pass** - Pre-commit hook runs tests
2. **No strict mode** - Be defensive with null/undefined checks
3. **Large App.tsx** - Consider this when making UI changes
4. **Types in types.ts** - Add new interfaces/enums there
5. **Services are stateless** - Use exported functions, not classes
6. **React 19** - Modern React features available
