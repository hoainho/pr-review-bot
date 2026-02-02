
// GitHub MCP Context Service
// Provides deep codebase context for enhanced PR reviews using GitHub MCP capabilities

export interface GitHubMCPContext {
  owner: string;
  repo: string;
  token: string;
  branch?: string;
  pullNumber?: number;
  baseBranch?: string;
  sourceBranch?: string;
}

export interface PRInfo {
  number: number;
  title: string;
  description: string;
  baseBranch: string;
  sourceBranch: string;
  headSha: string;
  baseSha: string;
  mergeable?: boolean;
  merged?: boolean;
  state: 'open' | 'closed';
}

export interface FileTreeItem {
  path: string;
  type: 'file' | 'dir';
  size?: number;
}

export interface FileContent {
  path: string;
  content: string;
  encoding?: string;
}

export interface RepositoryContext {
  fileTree: FileTreeItem[];
  relatedFiles: Map<string, FileContent>;
  constants: Map<string, FileContent>;
  componentRelations: ComponentRelation[];
}

export interface BranchAnalysis {
  baseBranch: string;
  sourceBranch: string;
  mergeBase: string; // commit hash where branches diverged
  divergedAt: string;
  commitsSinceDivergence: number;
  isMainBranch: boolean;
}

export interface CodePattern {
  type: 'architecture' | 'naming' | 'error_handling' | 'security' | 'performance';
  pattern: string;
  examples: string[];
  file?: string;
}

export interface ArchitecturalRule {
  rule: string;
  category: 'import' | 'export' | 'dependency' | 'config' | 'security';
  files: string[];
  description: string;
}

export interface LearningContext {
  baselineCodebase: RepositoryContext;
  currentCodebase: RepositoryContext;
  branchAnalysis: BranchAnalysis;
  learnedPatterns: CodePattern[];
  architecturalInsights: ArchitecturalRule[];
}

export interface ComponentRelation {
  sourceFile: string;
  relatedFiles: string[];
  relationType: 'import' | 'export' | 'dependency' | 'config';
}

export const fetchFileTree = async (
  context: GitHubMCPContext
): Promise<FileTreeItem[]> => {
  const response = await fetch(
    `https://api.github.com/repos/${context.owner}/${context.repo}/git/trees/${context.branch || 'HEAD'}?recursive=1`,
    {
      headers: {
        Authorization: `token ${context.token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch file tree: ${response.statusText}`);
  }

  const data = await response.json();
  return (data.tree || []).map((item: any) => ({
    path: item.path,
    type: item.type === 'blob' ? 'file' : 'dir',
    size: item.size,
  }));
};

export const fetchFileContent = async (
  context: GitHubMCPContext,
  filePath: string
): Promise<FileContent> => {
  const response = await fetch(
    `https://api.github.com/repos/${context.owner}/${context.repo}/contents/${filePath}?ref=${context.branch || 'HEAD'}`,
    {
      headers: {
        Authorization: `token ${context.token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch ${filePath}: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    path: filePath,
    content: data.content ? atob(data.content) : '',
    encoding: data.encoding,
  };
};

export const searchFilesByPattern = async (
  context: GitHubMCPContext,
  patternString: string,
  extension?: string[]
): Promise<FileTreeItem[]> => {
  const tree = await fetchFileTree(context);
  const patternRegex = new RegExp(patternString, 'i');

  return tree.filter((item) => {
    if (!item.path) return false;
    const matchesPattern = patternRegex.test(item.path);
    const matchesExtension = !extension || extension.some(ext => item.path.endsWith(ext));
    return matchesPattern && matchesExtension && item.type === 'file';
  });
};

export const extractImports = (content: string, filePath: string): string[] => {
  const imports: string[] = [];

  const es6ImportRegex = /import\s+(?:.*\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;
  while ((match = es6ImportRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  const commonJsRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = commonJsRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  const typeImportRegex = /import\s+type\s+\{[^}]+\}\s+from\s+['"]([^'"]+)['"]/g;
  while ((match = typeImportRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  return [...new Set(imports)];
};

export const buildComponentRelations = (
  files: Map<string, FileContent>
): ComponentRelation[] => {
  const relations: ComponentRelation[] = [];

  files.forEach((fileContent, filePath) => {
    const imports = extractImports(fileContent.content, filePath);
    const relatedFiles: string[] = [];

    imports.forEach((importPath) => {
      let resolvedPath = importPath;

      if (importPath.startsWith('.') || importPath.startsWith('..')) {
        const currentDir = filePath.split('/').slice(0, -1).join('/');
        resolvedPath = new URL(importPath, `file://${currentDir}/`).pathname.slice(1);
      }

      if (files.has(resolvedPath)) {
        relatedFiles.push(resolvedPath);
      }
    });

    if (relatedFiles.length > 0) {
      relations.push({
        sourceFile: filePath,
        relatedFiles,
        relationType: 'import',
      });
    }
  });

  return relations;
};

export const fetchPRInfo = async (
  context: GitHubMCPContext,
  pullNumber: number
): Promise<PRInfo> => {
  console.log(`[GitHub MCP] Fetching PR #${pullNumber} info...`);

  const response = await fetch(
    `https://api.github.com/repos/${context.owner}/${context.repo}/pulls/${pullNumber}`,
    {
      headers: {
        Authorization: `token ${context.token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch PR #${pullNumber}: ${response.statusText}`);
  }

  const data = await response.json();

  // Handle cases where head/ref might be null (deleted branches, etc.)
  const sourceBranch = data.head?.ref || data.head?.label || 'unknown';
  const baseBranch = data.base?.ref || 'main';

  return {
    number: data.number,
    title: data.title,
    description: data.body || '',
    baseBranch,
    sourceBranch,
    headSha: data.head.sha,
    baseSha: data.base.sha,
    mergeable: data.mergeable,
    merged: data.merged,
    state: data.state,
  };
};

export const fetchPRDiffFromBranchPoint = async (
  context: GitHubMCPContext,
  prInfo: PRInfo
): Promise<string> => {
  console.log(`[GitHub MCP] Fetching diff from branch point for PR #${prInfo.number}...`);

  const response = await fetch(
    `https://api.github.com/repos/${context.owner}/${context.repo}/compare/${prInfo.baseSha}...${prInfo.headSha}`,
    {
      headers: {
        Authorization: `token ${context.token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch PR diff from branch point: ${response.statusText}`);
  }

  const data = await response.json();
  return data.files?.map((file: any) => 
    `--- ${file.filename}\n+++ ${file.filename}\n${file.patch || ''}`
  ).join('\n\n') || '';
};

export const fetchBranchAnalysis = async (
  context: GitHubMCPContext,
  baseBranch: string = 'main',
  sourceBranch?: string
): Promise<BranchAnalysis> => {
  console.log(`[GitHub MCP] Analyzing branches: ${baseBranch} -> ${sourceBranch || 'HEAD'}`);

  const baseResponse = await fetch(
    `https://api.github.com/repos/${context.owner}/${context.repo}/git/refs/heads/${baseBranch}`,
    {
      headers: {
        Authorization: `token ${context.token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  );

  if (!baseResponse.ok) {
    throw new Error(`Failed to fetch base branch ${baseBranch}: ${baseResponse.statusText}`);
  }

  const baseData = await baseResponse.json();
  const baseCommit = baseData.object.sha;

  const sourceBranchName = sourceBranch || context.branch || 'HEAD';
  let sourceResponse: Response;

  if (sourceBranchName === 'HEAD') {
    sourceResponse = await fetch(
      `https://api.github.com/repos/${context.owner}/${context.repo}/git/HEAD`,
      {
        headers: {
          Authorization: `token ${context.token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );
  } else {
    sourceResponse = await fetch(
      `https://api.github.com/repos/${context.owner}/${context.repo}/git/refs/heads/${sourceBranchName}`,
      {
        headers: {
          Authorization: `token ${context.token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );
  }

  if (!sourceResponse.ok) {
    throw new Error(`Failed to fetch source branch ${sourceBranchName}: ${sourceResponse.statusText}`);
  }

  const sourceData = await sourceResponse.json();
  const sourceCommit = sourceData.object.sha;

  // Use compare endpoint to find merge base
  const compareResponse = await fetch(
    `https://api.github.com/repos/${context.owner}/${context.repo}/compare/${baseCommit}...${sourceCommit}`,
    {
      headers: {
        Authorization: `token ${context.token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  );

  let mergeBase = baseCommit;
  let commitsSinceDivergence = 0;

  if (compareResponse.ok) {
    const compareData = await compareResponse.json();
    commitsSinceDivergence = compareData.commits?.length || 0;
    
    // If there are commits, the merge base is the base of the comparison
    if (commitsSinceDivergence > 0 && compareData.base_commit) {
      mergeBase = compareData.base_commit.sha;
    }
  } else {
    // Fallback: try to find common ancestor via commits API
    console.warn(`[GitHub MCP] Compare endpoint failed, attempting fallback method`);
    mergeBase = baseCommit; // Use base branch commit as fallback
  }

  const commitResponse = await fetch(
    `https://api.github.com/repos/${context.owner}/${context.repo}/commits/${mergeBase}`,
    {
      headers: {
        Authorization: `token ${context.token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  );

  let divergedAt = '';
  if (commitResponse.ok) {
    const commitData = await commitResponse.json();
    divergedAt = commitData.commit?.committer?.date || '';
  }

  console.log(`[GitHub MCP] Branch analysis complete: diverged at ${mergeBase.substring(0, 7)}, ${commitsSinceDivergence} commits since`);

  return {
    baseBranch,
    sourceBranch: sourceBranch || context.branch || 'HEAD',
    mergeBase,
    divergedAt,
    commitsSinceDivergence,
    isMainBranch: baseBranch === 'main' || baseBranch === 'master',
  };
};

export const fetchRepositoryContextAtCommit = async (
  context: GitHubMCPContext,
  commitSha: string,
  maxFiles: number = 50
): Promise<RepositoryContext> => {
  console.log(`[GitHub MCP] Fetching repository context at commit ${commitSha.substring(0, 7)}...`);

  const treeResponse = await fetch(
    `https://api.github.com/repos/${context.owner}/${context.repo}/git/trees/${commitSha}?recursive=1`,
    {
      headers: {
        Authorization: `token ${context.token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  );

  if (!treeResponse.ok) {
    throw new Error(`Failed to fetch tree at ${commitSha}: ${treeResponse.statusText}`);
  }

  const treeData = await treeResponse.json();
  const fileTree = (treeData.tree || []).map((item: any) => ({
    path: item.path,
    type: item.type === 'blob' ? 'file' : 'dir',
    size: item.size,
  }));

  const [constantsFiles, typeFiles, componentFiles] = await Promise.all([
    searchFilesByPattern(context, 'constant|config|setting|env|config/', ['.ts', '.tsx', '.js', '.json']),
    searchFilesByPattern(context, 'type|interface|model|entity/', ['.ts', '.tsx', '.d.ts']),
    searchFilesByPattern(context, 'component|service|controller|hook|util/', ['.ts', '.tsx']),
  ]);

  const filesToFetch = [
    ...constantsFiles.slice(0, 5),
    ...typeFiles.slice(0, 5),
    ...componentFiles.slice(0, 10),
  ].slice(0, maxFiles);

  const relatedFiles = new Map<string, FileContent>();
  const constants = new Map<string, FileContent>();

  await Promise.all(
    filesToFetch.map(async (file) => {
      try {
        const content = await fetchFileContent(context, file.path);
        relatedFiles.set(file.path, content);

        const constantsPattern = /constant|config|setting|env|config/i;
        if (constantsPattern.test(file.path)) {
          constants.set(file.path, content);
        }
      } catch (error) {
        console.warn(`[GitHub MCP] Failed to fetch ${file.path}:`, error);
      }
    })
  );

  const componentRelations = buildComponentRelations(relatedFiles);

  console.log(`[GitHub MCP] Fetched ${relatedFiles.size} files, ${constants.size} constants, ${componentRelations.length} relations at ${commitSha.substring(0, 7)}`);

  return {
    fileTree,
    relatedFiles,
    constants,
    componentRelations,
  };
};

export const fetchRepositoryContext = async (
  context: GitHubMCPContext
): Promise<RepositoryContext> => {
  return fetchRepositoryContextAtCommit(context, 'HEAD', 20);
};

export const learnCodePatterns = (context: RepositoryContext): CodePattern[] => {
  const patterns: CodePattern[] = [];

  context.relatedFiles.forEach((file, filePath) => {
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return;

    const content = file.content;

    const securityPatterns = content.match(/(auth|token|password|secret|api[_-]?key|jwt)/gi);
    if (securityPatterns) {
      patterns.push({
        type: 'security',
        pattern: 'security-sensitive-variables',
        examples: securityPatterns.slice(0, 3),
        file: filePath,
      });
    }

    const errorHandling = content.match(/(try\s*{.*?}\s*catch|throw\s+new\s+\w+|\.catch\()/gs);
    if (errorHandling && errorHandling.length > 2) {
      patterns.push({
        type: 'error_handling',
        pattern: 'comprehensive-error-handling',
        examples: ['try-catch blocks', 'throw statements', 'Promise.catch()'],
        file: filePath,
      });
    }

    const performancePatterns = content.match(/(useMemo|useCallback|React\.memo|debounce|throttle)/g);
    if (performancePatterns) {
      patterns.push({
        type: 'performance',
        pattern: 'react-optimization',
        examples: [...new Set(performancePatterns)].slice(0, 3),
        file: filePath,
      });
    }

    const namingPatterns = content.match(/(const\s+[a-z][a-zA-Z]*[A-Z][a-zA-Z]*|function\s+[a-z][a-zA-Z]*[A-Z][a-zA-Z]*)/g);
    if (namingPatterns && namingPatterns.length > 3) {
      patterns.push({
        type: 'naming',
        pattern: 'camelCase-with-upper-acronyms',
        examples: namingPatterns.slice(0, 2),
        file: filePath,
      });
    }
  });

  return patterns;
};

export const extractArchitecturalRules = (context: RepositoryContext): ArchitecturalRule[] => {
  const rules: ArchitecturalRule[] = [];

  const importGroups = new Map<string, string[]>();
  context.relatedFiles.forEach((file, filePath) => {
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return;

    const imports = extractImports(file.content, filePath);
    imports.forEach(imp => {
      const category = imp.startsWith('.') ? 'internal' : 
                     imp.startsWith('@') ? 'scoped' : 'external';
      if (!importGroups.has(category)) importGroups.set(category, []);
      importGroups.get(category)!.push(filePath);
    });
  });

  importGroups.forEach((files, category) => {
    if (files.length > 5) {
      rules.push({
        rule: `extensive-${category}-imports`,
        category: 'import',
        files: files.slice(0, 10),
        description: `Project uses ${category} imports extensively across ${files.length} files`,
      });
    }
  });

  const configFiles = Array.from(context.constants.keys());
  if (configFiles.length > 0) {
    rules.push({
      rule: 'centralized-configuration',
      category: 'config',
      files: configFiles,
      description: 'Configuration is centralized in dedicated files',
    });
  }

  context.componentRelations.forEach(relation => {
    if (relation.relatedFiles.length > 5) {
      rules.push({
        rule: 'high-dependency-component',
        category: 'dependency',
        files: [relation.sourceFile, ...relation.relatedFiles],
        description: `${relation.sourceFile} has high dependency count (${relation.relatedFiles.length})`,
      });
    }
  });

  return rules;
};

export const buildLearningContextFromPR = async (
  context: GitHubMCPContext,
  pullNumber: number
): Promise<LearningContext> => {
  console.log(`[GitHub MCP] Building learning context from PR #${pullNumber}...`);

  const prInfo = await fetchPRInfo(context, pullNumber);
  const branchAnalysis = await fetchBranchAnalysis(context, prInfo.baseBranch, prInfo.sourceBranch);
  
  const [baselineCodebase, currentCodebase] = await Promise.all([
    fetchRepositoryContextAtCommit(context, branchAnalysis.mergeBase, 40),
    fetchRepositoryContextAtCommit(context, prInfo.headSha, 40),
  ]);

  const learnedPatterns = learnCodePatterns(currentCodebase);
  const architecturalInsights = extractArchitecturalRules(currentCodebase);

  console.log(`[GitHub MCP] PR Learning complete: ${learnedPatterns.length} patterns, ${architecturalInsights.length} rules`);

  return {
    baselineCodebase,
    currentCodebase,
    branchAnalysis,
    learnedPatterns,
    architecturalInsights,
  };
};

export const buildLearningContext = async (
  context: GitHubMCPContext,
  baseBranch: string = 'main',
  sourceBranch?: string
): Promise<LearningContext> => {
  console.log(`[GitHub MCP] Building learning context...`);

  const branchAnalysis = await fetchBranchAnalysis(context, baseBranch, sourceBranch);
  
  const [baselineCodebase, currentCodebase] = await Promise.all([
    fetchRepositoryContextAtCommit(context, branchAnalysis.mergeBase, 30),
    fetchRepositoryContextAtCommit(context, branchAnalysis.sourceBranch === 'HEAD' ? 'HEAD' : sourceBranch || 'HEAD', 30),
  ]);

  const learnedPatterns = learnCodePatterns(currentCodebase);
  const architecturalInsights = extractArchitecturalRules(currentCodebase);

  console.log(`[GitHub MCP] Learning complete: ${learnedPatterns.length} patterns, ${architecturalInsights.length} rules`);

  return {
    baselineCodebase,
    currentCodebase,
    branchAnalysis,
    learnedPatterns,
    architecturalInsights,
  };
};

export const formatContextForPrompt = (context: RepositoryContext): string => {
  let prompt = '';

  if (context.constants.size > 0) {
    prompt += '\n=== REPOSITORY CONSTANTS & CONFIG ===\n';
    context.constants.forEach((file, path) => {
      prompt += `\n--- File: ${path} ---\n`;
      prompt += file.content.substring(0, 2000);
      prompt += '\n... [truncated]\n';
    });
  }

  if (context.componentRelations.length > 0) {
    prompt += '\n=== COMPONENT RELATIONSHIPS ===\n';
    context.componentRelations.slice(0, 10).forEach((relation, idx) => {
      prompt += `\n${idx + 1}. ${relation.sourceFile}\n`;
      prompt += `   Depends on: ${relation.relatedFiles.join(', ')}\n`;
    });
  }

  prompt += '\n=== PROJECT STRUCTURE ===\n';
  prompt += `Total files: ${context.fileTree.length}\n`;
  prompt += `Key directories: ${new Set(context.fileTree.map(f => f.path.split('/')[0])).size}\n`;

  return prompt;
};

export const formatLearningContextForPrompt = (learningContext: LearningContext): string => {
  let prompt = '';

  prompt += '\n=== CODEBASE LEARNING INSIGHTS ===\n';
  prompt += `Base Branch: ${learningContext.branchAnalysis.baseBranch}\n`;
  prompt += `Source Branch: ${learningContext.branchAnalysis.sourceBranch}\n`;
  prompt += `Diverged At: ${learningContext.branchAnalysis.mergeBase.substring(0, 7)} (${learningContext.branchAnalysis.commitsSinceDivergence} commits since)\n\n`;

  if (learningContext.learnedPatterns.length > 0) {
    prompt += '=== LEARNED PATTERNS ===\n';
    const patternsByType = new Map<string, CodePattern[]>();
    learningContext.learnedPatterns.forEach(pattern => {
      if (!patternsByType.has(pattern.type)) patternsByType.set(pattern.type, []);
      patternsByType.get(pattern.type)!.push(pattern);
    });

    patternsByType.forEach((patterns, type) => {
      prompt += `\n${type.toUpperCase()}:\n`;
      patterns.slice(0, 3).forEach(pattern => {
        prompt += `  - ${pattern.pattern} (${pattern.examples.slice(0, 2).join(', ')})\n`;
      });
    });
  }

  if (learningContext.architecturalInsights.length > 0) {
    prompt += '\n=== ARCHITECTURAL RULES ===\n';
    learningContext.architecturalInsights.slice(0, 5).forEach(rule => {
      prompt += `\n- ${rule.rule}: ${rule.description}\n`;
      prompt += `  Files: ${rule.files.slice(0, 3).join(', ')}\n`;
    });
  }

  prompt += '\n=== BASELINE CODEBASE ===\n';
  prompt += formatContextForPrompt(learningContext.baselineCodebase);

  return prompt;
};
