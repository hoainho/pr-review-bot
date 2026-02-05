import { GoogleGenAI, Type } from "@google/genai";
import { ReviewResponse, CategorizedComment, PerformanceIssue, JSSyntaxImprovement, BreakingChange, CodeDuplication, PRIssue } from "../types";
import {
  getAvailableModelsForTask,
  ModelConfig
} from "./modelRotation";
import { fetchRepositoryContext, formatContextForPrompt, GitHubMCPContext } from "./githubMCPContext";
import {
  fetchAutoDiscoveredContext,
  formatPRDContextForPrompt,
  JiraConfluenceContext,
  JiraFetchResult
} from "./jiraConfluenceMCP";
import { analyzeDiffForPerformance, generatePerformancePromptSection } from "./performanceAnalyzer";
import { analyzeBreakingChangesFromDiff, generateBreakingChangeReport } from "./breakingChangeDetector";
import { analyzeDiffForDuplication, generateDuplicationReport } from "./codeDuplicationDetector";

const CHUNK_CONFIG = {
  MAX_FILES_PER_CHUNK: 20,
  MAX_LINES_PER_CHUNK: 1200,
  PARALLEL_CHUNKS: 2,
  LARGE_PR_THRESHOLD_FILES: 15,
  LARGE_PR_THRESHOLD_LINES: 800,
  DELAY_BETWEEN_CHUNKS_MS: 1000,
  RATE_LIMIT_BACKOFF_MS: 2000,
};

// ============================================================================
// DIFF CHUNKING UTILITIES
// ============================================================================

interface DiffChunk {
  files: string[];
  content: string;
  lineCount: number;
  chunkIndex: number;
  totalChunks: number;
}

interface ParsedFileDiff {
  fileName: string;
  content: string;
  lineCount: number;
}

/**
 * Parse diff into individual file diffs
 */
function parseDiffByFiles(diff: string): ParsedFileDiff[] {
  const files: ParsedFileDiff[] = [];
  const lines = diff.split('\n');
  
  let currentFile: string | null = null;
  let currentContent: string[] = [];
  
  for (const line of lines) {
    // Detect new file start
    const fileMatch = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (fileMatch) {
      // Save previous file
      if (currentFile && currentContent.length > 0) {
        files.push({
          fileName: currentFile,
          content: currentContent.join('\n'),
          lineCount: currentContent.length,
        });
      }
      currentFile = fileMatch[2];
      currentContent = [line];
      continue;
    }
    
    // Alternative file detection (for some diff formats)
    const plusFileMatch = line.match(/^\+\+\+ b\/(.+)$/);
    if (plusFileMatch && !currentFile) {
      currentFile = plusFileMatch[1];
    }
    
    if (currentFile) {
      currentContent.push(line);
    }
  }
  
  // Don't forget the last file
  if (currentFile && currentContent.length > 0) {
    files.push({
      fileName: currentFile,
      content: currentContent.join('\n'),
      lineCount: currentContent.length,
    });
  }
  
  return files;
}

/**
 * Create chunks from parsed file diffs
 */
function createChunks(fileDiffs: ParsedFileDiff[]): DiffChunk[] {
  const chunks: DiffChunk[] = [];
  let currentChunk: ParsedFileDiff[] = [];
  let currentLineCount = 0;
  
  for (const fileDiff of fileDiffs) {
    // Check if adding this file would exceed limits
    const wouldExceedFiles = currentChunk.length >= CHUNK_CONFIG.MAX_FILES_PER_CHUNK;
    const wouldExceedLines = currentLineCount + fileDiff.lineCount > CHUNK_CONFIG.MAX_LINES_PER_CHUNK;
    
    if (currentChunk.length > 0 && (wouldExceedFiles || wouldExceedLines)) {
      // Finalize current chunk
      chunks.push({
        files: currentChunk.map(f => f.fileName),
        content: currentChunk.map(f => f.content).join('\n\n'),
        lineCount: currentLineCount,
        chunkIndex: chunks.length,
        totalChunks: 0, // Will be set later
      });
      currentChunk = [];
      currentLineCount = 0;
    }
    
    currentChunk.push(fileDiff);
    currentLineCount += fileDiff.lineCount;
  }
  
  // Don't forget the last chunk
  if (currentChunk.length > 0) {
    chunks.push({
      files: currentChunk.map(f => f.fileName),
      content: currentChunk.map(f => f.content).join('\n\n'),
      lineCount: currentLineCount,
      chunkIndex: chunks.length,
      totalChunks: 0,
    });
  }
  
  // Set total chunks count
  const totalChunks = chunks.length;
  chunks.forEach(chunk => {
    chunk.totalChunks = totalChunks;
  });
  
  return chunks;
}

/**
 * Check if PR needs chunking
 */
function needsChunking(diff: string): boolean {
  const lineCount = diff.split('\n').length;
  const fileCount = (diff.match(/^diff --git/gm) || []).length;
  
  return lineCount > CHUNK_CONFIG.LARGE_PR_THRESHOLD_LINES || 
         fileCount > CHUNK_CONFIG.LARGE_PR_THRESHOLD_FILES;
}

// ============================================================================
// PROMPT BUILDERS
// ============================================================================

const buildChunkAnalysisPrompt = (
  chunkIndex: number,
  totalChunks: number,
  fileNames: string[],
  githubContextPrompt: string,
  prdContextPrompt: string
) => `You are reviewing CHUNK ${chunkIndex + 1}/${totalChunks} of a large PR.

FILES IN THIS CHUNK (${fileNames.length} files):
${fileNames.map(f => `• ${f}`).join('\n')}

REPOSITORY CONTEXT:
${githubContextPrompt}

PROJECT DOCUMENTATION:
${prdContextPrompt}

REVIEW EACH FILE THOROUGHLY. For every file, check for:
• Runtime errors, null/undefined issues
• Security vulnerabilities
• Race conditions, state bugs
• Memory/resource leaks
• Performance problems

OUTPUT: Return ALL issues found in this chunk. Be thorough - this is your ONLY chance to review these files.`;

const buildAnalysisPrompt = (
  isLargePR: boolean, 
  fileCount: number,
  githubContextPrompt: string,
  prdContextPrompt: string
) => `You are an expert senior principal engineer conducting a thorough security-focused code review.

PR ANALYSIS SCOPE:
${isLargePR ? 
  `This is a LARGE PR (${fileCount}+ files detected). Conduct comprehensive deep analysis focusing on critical production issues.` :
  `This is a standard PR. Focus on thorough but efficient analysis of critical issues.`
}

CONTEXT FROM REPOSITORY:
${githubContextPrompt}

CONTEXT FROM PROJECT DOCUMENTATION:
${prdContextPrompt}

ANALYSIS MISSION:
Examine this PR diff systematically to identify ONLY genuine issues that could impact production systems. Focus on critical problems that could cause real-world failures.

CRITICAL ISSUE CATEGORIES (report only these):
🔴 CRITICAL BUGS:
- Runtime exceptions, crashes, uncaught errors
- Null/undefined reference errors
- Race conditions, concurrency bugs  
- Memory leaks, resource exhaustion
- Security vulnerabilities (XSS, injection, auth bypass)
- Data corruption, state consistency issues
- Performance bottlenecks, O(N²) algorithms
- Resource leaks (file handles, connections, memory)

🟡 MINOR ISSUES (avoid unless severe):
- Code style, formatting, naming conventions
- Minor performance optimizations
- Non-breaking refactoring suggestions
- Documentation improvements

🔵 JS 2026 SYNTAX & PERFORMANCE:
- Outdated patterns that have modern ES2024+ alternatives
- Performance anti-patterns (O(n²), excessive re-renders, memory bloat)
- Missing modern JS features (structuredClone, Promise.withResolvers, Iterator helpers)
- Blocking main thread operations

ANALYSIS REQUIREMENTS:
✅ MUST INCLUDE:
- Exact file path and line numbers
- Specific code snippet showing the problem
- Clear explanation of potential impact
- Concrete fix proposal with corrected code

❌ EXCLUDE:
- Style suggestions, "would be clearer if..."
- Opinionated architectural changes
- "Consider using..." without concrete reason
- Minor optimizations that don't affect correctness

REPORTING FORMAT:
For each issue, provide structured feedback that helps developers:
1. **Problem**: What exactly is wrong and why it matters
2. **Impact**: How this could fail in production
3. **Solution**: Specific code fix, not suggestions
4. **Verification**: How to test the fix

ANALYSIS EXPECTATIONS:
${isLargePR ? 
  `For large PRs, provide thorough analysis without arbitrary comment limits. Focus on identifying genuine production risks.` :
  `For standard PRs, provide focused analysis on critical issues. Quality over quantity.`
}

Remember: Your analysis directly impacts code quality and production stability. Be precise, thorough, and scale appropriately based on PR complexity.`;

// Enhanced categorization prompt
const ENHANCED_CATEGORIZATION_PROMPT = `You are an expert code reviewer analyzing PR comments for actionability.

CATEGORIZATION MISSION:
Classify each comment based on impact urgency and required action.

CATEGORIES (choose exactly ONE):

🚨 CRITICAL_BUG:
- Runtime errors, crashes, exceptions
- Security vulnerabilities (authentication, injection, data exposure)
- Data loss, corruption, race conditions
- Performance issues that affect users
- Memory/resource leaks

📝 NITPICK:
- Code style, formatting, naming
- Minor performance micro-optimizations
- Documentation improvements
- "Would be clearer if..." suggestions
- Architectural preferences without concrete issues

💡 OTHER:
- General feedback, questions
- Enhancement suggestions
- Non-critical observations

DECISION FRAMEWORK:
1. **Impact**: Will this cause production issues if ignored?
2. **Urgency**: Does this need immediate attention?
3. **Actionability**: Can developer implement this easily?

RESPONSE FORMAT:
Return JSON array with:
- comment_index: number (from input)
- category: "CRITICAL_BUG" | "NITPICK" | "OTHER"
- reasoning: Brief justification (1-2 sentences)

Example:
{"comment_index": 0, "category": "CRITICAL_BUG", "reasoning": "Potential null reference could cause runtime crash"}

Prioritize developer productivity - focus on what needs action now vs what can wait.`;

interface RequestOptions {
  model: string;
  contents: string;
  systemInstruction: string;
  responseMimeType?: string;
  responseSchema?: object;
  abortSignal?: AbortSignal;
}

interface ProviderHandler {
  name: string;
  makeRequest: (options: RequestOptions) => Promise<{ text: string }>;
}

async function callGoogleGenAI(options: RequestOptions): Promise<{ text: string }> {
  if (options.abortSignal?.aborted) {
    throw new Error('Request cancelled');
  }

  const ai = new GoogleGenAI({
    apiKey: import.meta.env.VITE_GOOGLE_API_KEY || 'hoainho',
    httpOptions: { baseUrl: import.meta.env.VITE_OPENCODE_API_URL || 'http://34.60.22.68:8080' }
  });

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout after 10 minutes')), 10 * 60 * 1000);
  });

  const abortPromise = options.abortSignal 
    ? new Promise<never>((_, reject) => {
        options.abortSignal!.addEventListener('abort', () => reject(new Error('Request cancelled')));
      })
    : null;

  const responsePromise = ai.models.generateContent({
    model: options.model,
    contents: options.contents,
    config: {
      systemInstruction: options.systemInstruction,
      responseMimeType: options.responseMimeType,
      responseSchema: options.responseSchema,
    },
  });

  const racers = abortPromise 
    ? [responsePromise, timeoutPromise, abortPromise]
    : [responsePromise, timeoutPromise];

  const response = await Promise.race(racers);
  return { text: response.text || '' };
}

async function callOpenAICompatible(options: RequestOptions): Promise<{ text: string }> {
  if (options.abortSignal?.aborted) {
    throw new Error('Request cancelled');
  }

  const baseUrl = import.meta.env.VITE_OPENCODE_API_URL || 'http://34.60.22.68:8080';
  const apiKey = import.meta.env.VITE_OPENCODE_API_KEY || 'hoainho';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000);

  if (options.abortSignal) {
    options.abortSignal.addEventListener('abort', () => controller.abort());
  }

  const jsonInstructions = options.responseMimeType === 'application/json' 
    ? '\n\nIMPORTANT: You MUST respond with valid JSON only. No markdown, no explanation, just the JSON object.'
    : '';

  const systemContent = options.systemInstruction + jsonInstructions;

  try {
    const requestBody: Record<string, unknown> = {
      model: options.model,
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: options.contents },
      ],
      temperature: 0.2,
      max_tokens: 16384,
    };

    if (options.responseMimeType === 'application/json') {
      requestBody.response_format = { type: 'json_object' };
    }

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI-compatible API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || '';
    
    if (options.responseMimeType === 'application/json' && content) {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        content = jsonMatch[1].trim();
      } else {
        const codeMatch = content.match(/```\s*([\s\S]*?)\s*```/);
        if (codeMatch) {
          content = codeMatch[1].trim();
        }
      }
    }
    
    return { text: content };
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      if (options.abortSignal?.aborted) {
        throw new Error('Request cancelled');
      }
      throw new Error('Request timeout after 10 minutes');
    }
    throw error;
  }
}

function getProviderHandler(modelName: string): ProviderHandler {
  const isGeminiModel = modelName.startsWith('gemini');
  
  if (isGeminiModel) {
    console.log(`[Provider] ${modelName} → GoogleGenAI SDK`);
    return {
      name: 'GoogleGenAI',
      makeRequest: callGoogleGenAI,
    };
  }

  console.log(`[Provider] ${modelName} → OpenAI-Compatible API`);
  return {
    name: 'OpenAI-Compatible',
    makeRequest: callOpenAICompatible,
  };
}

interface RetryOptions {
  maxRetries?: number;
  task?: 'analyze' | 'categorize' | 'general';
  onModelRotate?: (currentModel: string, nextModel: string, attempt: number, quotaType: string) => void;
  onRetry?: (model: string, error: string, attempt: number, maxRetries: number) => void;
  onFinalError?: (errors: string[]) => void;
  abortSignal?: AbortSignal;
}

const MODEL_QUOTA_STATUS: Map<string, number> = new Map();
const COOLDOWN_MS = 60000;

function isQuotaExhausted(modelName: string): boolean {
  const lastError = MODEL_QUOTA_STATUS.get(modelName);
  if (!lastError) return false;
  return Date.now() - lastError < COOLDOWN_MS;
}

function markQuotaExhausted(modelName: string): void {
  MODEL_QUOTA_STATUS.set(modelName, Date.now());
}

function clearAllQuota(): void {
  MODEL_QUOTA_STATUS.clear();
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const patterns = [
      'capacity', 'rate limit', 'quota', 'temporarily unavailable',
      'overloaded', '503', '429', 'timeout', 'network',
      'econnreset', 'etimedout', 'socket hang up', 'empty response',
      'too many requests', 'resource exhausted', 'insufficient quota',
      'unknown provider', 'provider not found', 'invalid provider',
      'model not found', 'unsupported model', 'not found model',
      'request timeout after 10 minutes', 'the operation was cancelled', 'cancelled'
    ];
    return patterns.some(p => message.includes(p));
  }
  return false;
}

async function executeWithRetry<T>(
  taskFn: (model: ModelConfig, abortSignal?: AbortSignal) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const task = options.task || 'general';
  const maxRetries = options.maxRetries || 5;
  const errors: string[] = [];
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (options.abortSignal?.aborted) {
      throw new Error('Request cancelled');
    }

    let availableModels = getAvailableModelsForTask(task)
      .filter(m => !isQuotaExhausted(m.name));

    if (availableModels.length === 0) {
      clearAllQuota();
      availableModels = getAvailableModelsForTask(task);
    }

    const triedModels = new Set<string>();

    for (let modelIndex = 0; modelIndex < availableModels.length; modelIndex++) {
      const model = availableModels[modelIndex];

      if (triedModels.has(model.name)) continue;
      triedModels.add(model.name);

      try {
        return await taskFn(model, options.abortSignal);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (lastError.message === 'Request cancelled') {
          throw lastError;
        }
        
        errors.push(`${model.displayName}: ${lastError.message}`);

        if (options.onRetry) {
          options.onRetry(model.displayName, lastError.message, attempt + 1, maxRetries);
        }

        if (!isRetryableError(lastError)) {
          if (options.onFinalError) options.onFinalError(errors);
          throw lastError;
        }

        markQuotaExhausted(model.name);

        const nextModel = availableModels[modelIndex + 1];
        if (nextModel && options.onModelRotate) {
          options.onModelRotate(
            model.displayName,
            nextModel.displayName,
            attempt + 1,
            model.quotaType || 'unknown'
          );
        }
      }
    }
  }

  if (options.onFinalError) options.onFinalError(errors);
  throw lastError || new Error(`All models failed after ${maxRetries} retries`);
}

export interface EnhancedReviewResponse extends ReviewResponse {
  performanceIssues?: PerformanceIssue[];
  syntaxImprovements?: JSSyntaxImprovement[];
  breakingChanges?: BreakingChange[];
  codeDuplications?: CodeDuplication[];
}

export interface AnalysisProgress {
  currentChunk: number;
  totalChunks: number;
  currentFiles: string[];
  status: 'analyzing' | 'complete' | 'error';
}

export type ProgressCallback = (progress: AnalysisProgress) => void;

const CONCISE_SYSTEM_INSTRUCTION = `You are a senior engineer doing code review. Be CONCISE and ACTIONABLE.

REVIEW FOCUS:
- Runtime errors, crashes, null issues
- Security vulnerabilities  
- Race conditions, state bugs
- Memory/resource leaks
- Performance problems (O(n²), infinite loops)

SKIP:
- Style/formatting suggestions
- "Consider..." without concrete bugs
- Documentation improvements

OUTPUT FORMAT for each issue:
- bug_description: ONE sentence. What's wrong and why it matters.
- severity: HIGH (crashes/security) | MEDIUM (bugs) | LOW (minor)
- suggested_fix: ONE sentence. The exact fix.
- suggested_code: Working replacement code only.
- prd_related: true if this issue relates to PRD/TDD requirements from Confluence documentation context, false otherwise.

Be brief. No fluff. Every word must add value.`;

async function analyzeChunk(
  chunk: DiffChunk,
  githubContextPrompt: string,
  prdContextPrompt: string,
  onProgress?: ProgressCallback,
  abortSignal?: AbortSignal
): Promise<PRIssue[]> {
  if (onProgress) {
    onProgress({
      currentChunk: chunk.chunkIndex + 1,
      totalChunks: chunk.totalChunks,
      currentFiles: chunk.files,
      status: 'analyzing',
    });
  }

  console.log(`[Chunk ${chunk.chunkIndex + 1}/${chunk.totalChunks}] Analyzing ${chunk.files.length} files: ${chunk.files.slice(0, 3).join(', ')}${chunk.files.length > 3 ? '...' : ''}`);

  const result = await executeWithRetry(
    async (model, signal) => {
      const handler = getProviderHandler(model.sdkModelName);
      
      const chunkPrompt = buildChunkAnalysisPrompt(
        chunk.chunkIndex,
        chunk.totalChunks,
        chunk.files,
        githubContextPrompt,
        prdContextPrompt
      );

      const response = await handler.makeRequest({
        model: model.sdkModelName,
        contents: `${chunkPrompt}\n\n=== DIFF ===\n${chunk.content}`,
        systemInstruction: CONCISE_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            issues: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  bug_description: { type: Type.STRING },
                  severity: { type: Type.STRING, enum: ["HIGH", "MEDIUM", "LOW"] },
                  bug_type: { type: Type.STRING, enum: ["RACE_CONDITION", "STATE_MANAGEMENT", "MEMORY_LEAK", "SECURITY", "CRASH", "CORRUPTION", "PERFORMANCE", "RESOURCE_LEAK"] },
                  file_name: { type: Type.STRING },
                  line_numbers: { type: Type.STRING },
                  snippet: { type: Type.STRING },
                  suggested_fix: { type: Type.STRING },
                  suggested_code: { type: Type.STRING },
                  prd_related: { type: Type.BOOLEAN },
                },
                required: ["bug_description", "severity", "bug_type", "file_name", "line_numbers", "snippet", "suggested_fix", "suggested_code", "prd_related"],
              },
            },
          },
          required: ["issues"],
        },
        abortSignal: signal,
      });

      const parsed = JSON.parse(response.text || '{"issues": []}') as ReviewResponse;
      return parsed.issues || [];
    },
    {
      task: 'analyze',
      maxRetries: 5,
      abortSignal,
      onRetry: (model, error) => {
        console.warn(`[Chunk ${chunk.chunkIndex + 1}] Retry on ${model}: ${error}`);
      },
    }
  );

  console.log(`[Chunk ${chunk.chunkIndex + 1}/${chunk.totalChunks}] Found ${result.length} issues`);
  return result;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function analyzeChunkWithBackoff(
  chunk: DiffChunk,
  githubContextPrompt: string,
  prdContextPrompt: string,
  onProgress?: ProgressCallback,
  abortSignal?: AbortSignal,
  retryCount = 0
): Promise<PRIssue[]> {
  try {
    return await analyzeChunk(chunk, githubContextPrompt, prdContextPrompt, onProgress, abortSignal);
  } catch (error) {
    if (error instanceof Error && error.message === 'Request cancelled') {
      throw error;
    }
    
    const isRateLimit = error instanceof Error && 
      (error.message.includes('429') || error.message.includes('RATE_LIMIT') || error.message.includes('RESOURCE_EXHAUSTED'));
    
    if (isRateLimit && retryCount < 3) {
      const backoffMs = CHUNK_CONFIG.RATE_LIMIT_BACKOFF_MS * (retryCount + 1);
      console.log(`[Rate Limit] Waiting ${backoffMs}ms before retry (attempt ${retryCount + 1}/3)`);
      await sleep(backoffMs);
      return analyzeChunkWithBackoff(chunk, githubContextPrompt, prdContextPrompt, onProgress, abortSignal, retryCount + 1);
    }
    throw error;
  }
}

async function processChunksSequentially(
  chunks: DiffChunk[],
  githubContextPrompt: string,
  prdContextPrompt: string,
  onProgress?: ProgressCallback,
  shouldPause?: () => boolean,
  shouldCancel?: () => boolean,
  abortSignal?: AbortSignal
): Promise<PRIssue[]> {
  const allIssues: PRIssue[] = [];
  
  for (let i = 0; i < chunks.length; i++) {
    if (shouldCancel?.() || abortSignal?.aborted) {
      console.log('[Sequential] Cancelled by user');
      break;
    }
    
    while (shouldPause?.()) {
      console.log('[Sequential] Paused, waiting...');
      await sleep(500);
      if (shouldCancel?.() || abortSignal?.aborted) break;
    }
    
    const chunk = chunks[i];
    console.log(`[Sequential] Processing chunk ${i + 1}/${chunks.length}`);
    
    const issues = await analyzeChunkWithBackoff(chunk, githubContextPrompt, prdContextPrompt, onProgress, abortSignal);
    allIssues.push(...issues);
    
    if (i < chunks.length - 1) {
      console.log(`[Sequential] Waiting ${CHUNK_CONFIG.DELAY_BETWEEN_CHUNKS_MS}ms before next chunk`);
      await sleep(CHUNK_CONFIG.DELAY_BETWEEN_CHUNKS_MS);
    }
  }
  
  return allIssues;
}

export const analyzeDiff = async (
  diff: string,
  githubContext?: GitHubMCPContext,
  jiraContext?: JiraConfluenceContext,
  prTitle?: string,
  prDescription?: string,
  options?: {
    enableJS2026?: boolean;
    enablePerformanceAnalysis?: boolean;
    enableBreakingChangeDetection?: boolean;
    enableDuplicationDetection?: boolean;
    onProgress?: ProgressCallback;
    shouldPause?: () => boolean;
    shouldCancel?: () => boolean;
  }
): Promise<EnhancedReviewResponse> => {
  const opts = {
    enableJS2026: true,
    enablePerformanceAnalysis: true,
    enableBreakingChangeDetection: true,
    enableDuplicationDetection: true,
    ...options,
  };

  const abortController = new AbortController();
  
  const checkCancel = () => {
    if (opts.shouldCancel?.()) {
      abortController.abort();
      return true;
    }
    return false;
  };

  let performanceIssues: PerformanceIssue[] = [];
  let syntaxImprovements: JSSyntaxImprovement[] = [];
  let breakingChanges: BreakingChange[] = [];
  let codeDuplications: CodeDuplication[] = [];

  if (opts.enableJS2026 || opts.enablePerformanceAnalysis) {
    console.log('[Analysis] Running performance & JS2026 analyzer...');
    const perfResult = analyzeDiffForPerformance(diff);
    performanceIssues = perfResult.performanceIssues;
    syntaxImprovements = perfResult.syntaxImprovements;
    console.log(`[Analysis] Found ${performanceIssues.length} performance issues, ${syntaxImprovements.length} syntax improvements`);
  }

  if (opts.enableBreakingChangeDetection) {
    console.log('[Analysis] Running breaking change detector...');
    breakingChanges = analyzeBreakingChangesFromDiff(diff);
    console.log(`[Analysis] Found ${breakingChanges.length} potential breaking changes`);
  }

  if (opts.enableDuplicationDetection) {
    console.log('[Analysis] Running code duplication detector...');
    codeDuplications = analyzeDiffForDuplication(diff);
    console.log(`[Analysis] Found ${codeDuplications.length} code duplication patterns`);
  }

  const githubContextPrompt = githubContext
    ? await formatContextForPrompt(await fetchRepositoryContext(githubContext))
    : 'No repository context.';

  let prdContextPrompt = 'No PRD context.';
  
  if (jiraContext) {
    const jiraResult = await fetchAutoDiscoveredContext(jiraContext, diff, prTitle || diff);
    
    if (jiraResult.errors.length > 0) {
      console.warn('[Jira] Errors during fetch:', jiraResult.errors);
    }
    
    if (jiraResult.ticketKeysFound.length > 0) {
      console.log(`[Jira] Found ${jiraResult.ticketKeysFound.length} ticket keys: ${jiraResult.ticketKeysFound.join(', ')}`);
    }
    
    if (jiraResult.context && (jiraResult.context.tickets.length > 0 || jiraResult.context.documentation.length > 0)) {
      prdContextPrompt = await formatPRDContextForPrompt(jiraResult.context);
      console.log(`[Jira] Context loaded: ${jiraResult.context.tickets.length} tickets, ${jiraResult.context.documentation.length} docs`);
    } else {
      prdContextPrompt = jiraResult.errors.length > 0 
        ? `Jira integration enabled but encountered errors: ${jiraResult.errors.join('; ')}`
        : 'No Jira ticket keys found in PR (format: PROJECT-123).';
    }
  }

  let aiIssues: PRIssue[] = [];

  if (checkCancel()) {
    return { issues: [], performanceIssues, syntaxImprovements, breakingChanges, codeDuplications };
  }

  if (needsChunking(diff)) {
    console.log('[Analysis] Large PR detected - using chunked analysis');
    
    const fileDiffs = parseDiffByFiles(diff);
    const chunks = createChunks(fileDiffs);
    
    console.log(`[Analysis] Split into ${chunks.length} chunks from ${fileDiffs.length} files`);
    
    aiIssues = await processChunksSequentially(
      chunks,
      githubContextPrompt,
      prdContextPrompt,
      opts.onProgress,
      opts.shouldPause,
      opts.shouldCancel,
      abortController.signal
    );
    
    console.log(`[Analysis] Total issues from all chunks: ${aiIssues.length}`);
  } else {
    console.log('[Analysis] Standard PR - using single analysis');
    
    if (checkCancel()) {
      return { issues: [], performanceIssues, syntaxImprovements, breakingChanges, codeDuplications };
    }
    
    const diffLines = diff.split('\n').length;
    const fileCount = (diff.match(/^\+\+\+|^diff/gm) || []).length;
    const isLargePR = diffLines > 500 || fileCount > 10;

    const performanceSection = generatePerformancePromptSection(performanceIssues, syntaxImprovements);
    const breakingChangeSection = generateBreakingChangeReport(breakingChanges);
    const duplicationSection = generateDuplicationReport(codeDuplications);
    
    try {
      const result = await executeWithRetry(
        async (model, signal) => {
          console.log(`[Model] Using ${model.displayName} (${model.sdkModelName})`);

          const handler = getProviderHandler(model.sdkModelName);
          const analysisPrompt = buildAnalysisPrompt(isLargePR, fileCount, githubContextPrompt, prdContextPrompt);
          
          const enhancedPrompt = `${analysisPrompt}\n${performanceSection}\n${breakingChangeSection}\n${duplicationSection}`;

          const response = await handler.makeRequest({
            model: model.sdkModelName,
            contents: `=== PR DIFF ===\n\n${diff}\n\n${enhancedPrompt}`,
            systemInstruction: CONCISE_SYSTEM_INSTRUCTION,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                issues: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      bug_description: { type: Type.STRING },
                      severity: { type: Type.STRING, enum: ["HIGH", "MEDIUM", "LOW"] },
                      bug_type: { type: Type.STRING, enum: ["RACE_CONDITION", "STATE_MANAGEMENT", "MEMORY_LEAK", "SECURITY", "CRASH", "CORRUPTION", "PERFORMANCE", "RESOURCE_LEAK"] },
                      file_name: { type: Type.STRING },
                      line_numbers: { type: Type.STRING },
                      snippet: { type: Type.STRING },
                      suggested_fix: { type: Type.STRING },
                      suggested_code: { type: Type.STRING },
                      prd_related: { type: Type.BOOLEAN },
                    },
                    required: ["bug_description", "severity", "bug_type", "file_name", "line_numbers", "snippet", "suggested_fix", "suggested_code", "prd_related"],
                  },
                },
              },
              required: ["issues"],
            },
            abortSignal: signal,
          });

          const aiResult = JSON.parse(response.text || '{"issues": []}') as ReviewResponse;
          return aiResult.issues || [];
        },
        {
          task: 'analyze',
          maxRetries: 10,
          abortSignal: abortController.signal,
          onModelRotate: (current, next, attempt) => {
            console.warn(`[Retry ${attempt}] ${current} exhausted, trying ${next}`);
          },
          onRetry: (model, error) => {
            console.warn(`[Error] ${model}: ${error}`);
          },
          onFinalError: (errors) => {
            console.error('[Final] All models failed:', errors);
          }
        }
      );
      
      aiIssues = result;
    } catch (error) {
      if (error instanceof Error && error.message === 'Request cancelled') {
        console.log('[Analysis] Cancelled by user');
        return { issues: [], performanceIssues, syntaxImprovements, breakingChanges, codeDuplications };
      }
      throw error;
    }
  }

  if (opts.onProgress) {
    opts.onProgress({
      currentChunk: 0,
      totalChunks: 0,
      currentFiles: [],
      status: 'complete',
    });
  }

  return {
    issues: aiIssues,
    performanceIssues,
    syntaxImprovements,
    breakingChanges,
    codeDuplications,
  };
};

export const categorizeComments = async (prNumber: string, botName: string, comments: string): Promise<CategorizedComment[]> => {
  const result = await executeWithRetry(
    async (model) => {
      console.log(`[Model] Using ${model.displayName} (${model.sdkModelName}) via ${getProviderHandler(model.sdkModelName).name}`);

      const handler = getProviderHandler(model.sdkModelName);

      const systemInstruction = `You are an expert code reviewer analyzing PR comments for actionability.

CATEGORIZATION MISSION:
Classify each comment based on impact urgency and required action.

CATEGORIES (choose exactly ONE):

🚨 CRITICAL_BUG:
- Runtime errors, crashes, exceptions
- Security vulnerabilities (auth, injection, data exposure)
- Data loss, corruption, race conditions
- Performance issues that affect users
- Memory/resource leaks
- Anything that could break production

📝 NITPICK:
- Code style, formatting, naming
- Minor performance micro-optimizations
- Documentation improvements
- "Would be clearer if..." suggestions
- Architectural preferences without concrete issues

💡 OTHER:
- General feedback, questions
- Enhancement suggestions
- Non-critical observations

DECISION FRAMEWORK:
1. **Impact**: Will this cause production issues if ignored?
2. **Urgency**: Does this need immediate attention?
3. **Actionability**: Can developer implement this easily?

RESPONSE FORMAT:
Return JSON array with:
- comment_index: number (from input)
- category: "CRITICAL_BUG" | "NITPICK" | "OTHER"
- reasoning: Brief justification (1-2 sentences)

Example:
{"comment_index": 0, "category": "CRITICAL_BUG", "reasoning": "Potential null reference could cause runtime crash"}

Prioritize developer productivity - focus on what needs action now vs what can wait.`;

      const response = await handler.makeRequest({
        model: model.sdkModelName,
        contents: `PR #${prNumber} by ${botName}:\n\n${comments}`,
        systemInstruction: ENHANCED_CATEGORIZATION_PROMPT,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              comment_index: { type: Type.STRING },
              category: { type: Type.STRING, enum: ["CRITICAL_BUG", "NITPICK", "OTHER"] },
              reasoning: { type: Type.STRING },
            },
            required: ["comment_index", "category", "reasoning"],
          },
        },
      });

      try {
        return JSON.parse(response.text || '[]') as CategorizedComment[];
      } catch (error) {
        throw new Error(`Invalid response format from ${handler.name}`);
      }
    },
    {
      task: 'categorize',
      maxRetries: 10,
      onModelRotate: (current, next, attempt) => {
        console.warn(`[Retry ${attempt}] ${current} exhausted, trying ${next}`);
      },
      onRetry: (model, error) => {
        console.warn(`[Error] ${model}: ${error}`);
      },
      onFinalError: (errors) => {
        console.error('[Final] All models failed:');
        errors.forEach((e, i) => console.error(`  ${i + 1}. ${e}`));
      }
    }
  );

  return result;
};