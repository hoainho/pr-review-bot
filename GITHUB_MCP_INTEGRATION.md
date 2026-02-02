# GitHub MCP Integration - Implementation Summary

## Overview
GitHub MCP (Model Context Protocol) integration has been added to provide AI agents with deep codebase context for enhanced PR reviews.

## New Features

### 1. Repository Context Service (`services/githubMCPContext.ts`)
New service that provides comprehensive codebase understanding:

**Capabilities:**
- **File Tree Discovery**: Fetches complete repository structure
- **File Content Retrieval**: Reads specific files with full content
- **Pattern-Based Search**: Finds files matching patterns (constants, configs, types, components)
- **Import/Dependency Analysis**: Builds component relationship maps
- **Constant Extraction**: Identifies configuration and constants files

**Key Functions:**
```typescript
// Fetch repository structure
fetchFileTree(context) -> FileTreeItem[]

// Read specific file
fetchFileContent(context, filePath) -> FileContent

// Find files by pattern
searchFilesByPattern(context, pattern, extensions) -> FileTreeItem[]

// Extract imports/dependencies
extractImports(content, filePath) -> string[]

// Build component relationships
buildComponentRelations(files) -> ComponentRelation[]

// Get comprehensive context
fetchRepositoryContext(context) -> RepositoryContext

// Format for AI prompt
formatContextForPrompt(context) -> string
```

### 2. Enhanced PR Analysis (`services/geminiService.ts`)

**Changes:**
- Added `GitHubMCPContext` parameter to `analyzeDiff` function
- Repository context is now fetched and passed to AI models
- Context includes:
  - Repository constants and configuration files
  - Component relationships and dependencies
  - Project structure overview
- Context is optional for backward compatibility

**Prompt Enhancement:**
```typescript
const contextPrompt = githubContext
  ? await formatContextForPrompt(await fetchRepositoryContext(githubContext))
  : '\nNo repository context available.\n';

const prompt = `=== PR DIFF ===
${diff}

${DIFF_ANALYSIS_TEMPLATE}
```

### 3. UI Updates (`App.tsx`)

**New Features:**
- **Toggle Switch**: Enable/disable deep context analysis
- **State Management**: Added `useGitHubContext` state
- **Enhanced Analysis Flow**: Passes GitHub context when enabled
- **User Control**: Users can choose between fast diff-only or deep context analysis

**UI Elements Added:**
```tsx
const [useGitHubContext, setUseGitHubContext] = useState(true);

// In GitHub Integration Panel:
<label className="flex items-center space-x-2 cursor-pointer">
  <input
    type="checkbox"
    checked={useGitHubContext}
    onChange={(e) => setUseGitHubContext(e.target.checked)}
  />
  <span>Enable Deep Context Analysis</span>
</label>
```

## Benefits

### For AI Agents:
1. **Better Context Awareness**: Understands repository structure beyond the diff
2. **Component Relationships**: Knows which files depend on each other
3. **Constants Discovery**: Accesses configuration and constant definitions
4. **Architecture Understanding**: Sees overall project organization

### For PR Reviews:
1. **More Accurate Analysis**: Can reference related files when reviewing changes
2. **Better Suggestions**: Understands architectural patterns in the codebase
3. **Reduced False Positives**: Has context to validate assumptions
4. **Holistic Review**: Considers impact across multiple files

### For Users:
1. **Control Over Depth**: Choose between fast diff-only or deep analysis
2. **Transparent Context**: See what files are being analyzed
3. **Optimized API Usage**: Limits context to avoid hitting rate limits

## Data Flow

```
User Input
    ↓
Parse GitHub URL
    ↓
Fetch PR Diff
    ↓
[Optional] Fetch Repository Context
    ├─→ File Tree (structure)
    ├─→ Constants/Config Files
    ├─→ Type Definitions
    ├─→ Component Files
    └─→ Build Component Relations
    ↓
Format Context for AI
    ↓
Analyze with Gemini Model
    ↓
Generate Review Issues
    ↓
Display Results
```

## Technical Details

### API Limits Handled
- **Max Files Fetched**: 20 (to stay within GitHub API limits)
- **Constants**: Up to 5 files
- **Type Files**: Up to 5 files
- **Component Files**: Up to 10 files
- **Content Truncation**: 2000 characters per file to fit in AI context

### Pattern Matching
Files are categorized using regex patterns:
- **Constants/Config**: `/constant|config|setting|env|config/`
- **Types**: `/type|interface|model|entity/`
- **Components**: `/component|service|controller|hook|util/`

### Component Relations
Relationship types detected:
- **Import**: ES6 imports, CommonJS requires, TypeScript type imports
- **Export**: Module exports (future enhancement)
- **Dependency**: Package dependencies (future enhancement)
- **Config**: Configuration file references (future enhancement)

## Usage

### Basic Usage (Diff Only - Fast)
```typescript
// In App.tsx
const data = await analyzeDiff(diff);
```

### Enhanced Usage (With Repository Context - Deep)
```typescript
// Parse PR URL to get owner/repo
const prInfo = parseGitHubUrl(githubUrl);

// Create GitHub MCP context
const githubContext: GitHubMCPContext = {
  owner: prInfo.owner,
  repo: prInfo.repo,
  token: githubToken,
};

// Analyze with deep context
const data = await analyzeDiff(diff, githubContext);
```

## Future Enhancements

Potential improvements:
1. **Cache Repository Context**: Store context locally to reduce API calls
2. **Incremental Updates**: Only fetch changed files in subsequent reviews
3. **Git History Analysis**: Understand commit patterns over time
4. **CodeQL Integration**: Use GitHub CodeQL for security analysis
5. **Customizable Depth**: Let users control how much context to fetch

## Files Modified

- ✅ `services/githubMCPContext.ts` - New file
- ✅ `services/geminiService.ts` - Enhanced with context parameter
- ✅ `App.tsx` - Added toggle for context analysis
- ✅ `types.ts` - No changes (uses existing types)

## Testing

TypeScript compilation verified: ✅ No errors
```bash
node_modules/.bin/tsc --noEmit
# Exit code: 0
```
