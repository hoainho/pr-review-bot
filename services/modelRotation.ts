
export type ModelProvider = 'antigravity' | 'gemini' | 'opencode' | 'anthropic' | 'openai' | 'gitlab';

export interface ModelConfig {
  name: string;
  displayName: string;
  sdkModelName: string;
  provider: ModelProvider;
  endpoint?: string;
  capabilities: ('analyze' | 'categorize' | 'general')[];
  contextWindow?: number;
  maxOutputTokens?: number;
  priority?: number;
  quotaType?: 'antigravity' | 'gemini-cli' | 'opencode' | 'gitlab' | 'anthropic' | 'combined';
}

export const MODEL_ROTATION_ORDER: ModelConfig[] = [
  // === CLAUDE (Priority 1-3) ===
  {
    name: 'claude-opus-4-6-thinking',
    displayName: 'Claude Opus 4.6 Thinking',
    sdkModelName: 'claude-opus-4-6-thinking',
    provider: 'anthropic',
    capabilities: ['analyze', 'categorize', 'general'],
    contextWindow: 200000,
    maxOutputTokens: 16384,
    priority: 1,
    quotaType: 'anthropic'
  },
  {
    name: 'claude-sonnet-4-5',
    displayName: 'Claude Sonnet 4.5',
    sdkModelName: 'gemini-claude-sonnet-4-5',
    provider: 'anthropic',
    capabilities: ['analyze', 'categorize', 'general'],
    contextWindow: 200000,
    maxOutputTokens: 16384,
    priority: 2,
    quotaType: 'anthropic'
  },
  {
    name: 'claude-sonnet-4-5-thinking',
    displayName: 'Claude Sonnet 4.5 Thinking',
    sdkModelName: 'gemini-claude-sonnet-4-5-thinking',
    provider: 'anthropic',
    capabilities: ['analyze', 'categorize', 'general'],
    contextWindow: 200000,
    maxOutputTokens: 16384,
    priority: 3,
    quotaType: 'anthropic'
  },
  // === GEMINI (Priority 4-8) ===
  {
    name: 'gemini-3-pro-preview',
    displayName: 'Gemini 3 Pro Preview',
    sdkModelName: 'gemini-3-pro-preview',
    provider: 'gemini',
    capabilities: ['analyze', 'categorize', 'general'],
    contextWindow: 1048576,
    maxOutputTokens: 65536,
    priority: 4,
    quotaType: 'antigravity'
  },
  {
    name: 'gemini-3-flash-preview',
    displayName: 'Gemini 3 Flash Preview',
    sdkModelName: 'gemini-3-flash-preview',
    provider: 'gemini',
    capabilities: ['analyze', 'categorize', 'general'],
    contextWindow: 1048576,
    maxOutputTokens: 65536,
    priority: 5,
    quotaType: 'antigravity'
  },
  {
    name: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    sdkModelName: 'gemini-2.5-flash',
    provider: 'gemini',
    capabilities: ['analyze', 'categorize', 'general'],
    contextWindow: 1048576,
    maxOutputTokens: 65536,
    priority: 6,
    quotaType: 'antigravity'
  },
  {
    name: 'gemini-2.5-flash-lite',
    displayName: 'Gemini 2.5 Flash Lite',
    sdkModelName: 'gemini-2.5-flash-lite',
    provider: 'gemini',
    capabilities: ['analyze', 'categorize', 'general'],
    contextWindow: 1048576,
    maxOutputTokens: 65536,
    priority: 7,
    quotaType: 'antigravity'
  },
  // === OTHER MODELS (Priority 8-9) ===
  {
    name: 'gpt-oss-120b-medium',
    displayName: 'GPT OSS 120B Medium',
    sdkModelName: 'gpt-oss-120b-medium',
    provider: 'openai',
    capabilities: ['analyze', 'categorize', 'general'],
    contextWindow: 128000,
    maxOutputTokens: 16384,
    priority: 8,
    quotaType: 'antigravity'
  },
  {
    name: 'gemini-3-pro-image-preview',
    displayName: 'Gemini 3 Pro Image Preview',
    sdkModelName: 'gemini-3-pro-image-preview',
    provider: 'gemini',
    capabilities: ['analyze', 'general'],
    contextWindow: 1048576,
    maxOutputTokens: 65536,
    priority: 9,
    quotaType: 'antigravity'
  },
];

const MODEL_QUOTA_STATUS: Map<string, { lastError: number; rateLimited: boolean }> = new Map();

export function isQuotaAvailable(modelName: string): boolean {
  const status = MODEL_QUOTA_STATUS.get(modelName);
  if (!status) return true;
  const cooldown = 60000;
  return Date.now() - status.lastError > cooldown;
}

export function markModelQuotaExhausted(modelName: string): void {
  MODEL_QUOTA_STATUS.set(modelName, {
    lastError: Date.now(),
    rateLimited: true
  });
}

export function clearModelQuotaStatus(modelName: string): void {
  MODEL_QUOTA_STATUS.delete(modelName);
}

export function clearModelQuotaStatusByProvider(provider: string): void {
  for (const [key] of MODEL_QUOTA_STATUS) {
    if (key.startsWith(provider)) {
      MODEL_QUOTA_STATUS.delete(key);
    }
  }
}

export function clearAllQuotaExhaustion(): void {
  MODEL_QUOTA_STATUS.clear();
}

export function getAvailableModelsForTask(
  task: 'analyze' | 'categorize' | 'general'
): ModelConfig[] {
  return MODEL_ROTATION_ORDER
    .filter(model =>
      model.capabilities.includes(task) && isQuotaAvailable(model.name)
    )
    .sort((a, b) => (a.priority || 100) - (b.priority || 100));
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const retryablePatterns = [
      'capacity',
      'rate limit',
      'quota',
      'temporarily unavailable',
      'overloaded',
      '503',
      '429',
      'timeout',
      'network',
      'econnreset',
      'etimedout',
      'socket hang up',
      'empty response',
      'model overloaded',
      'try again',
      'please retry',
      'too many requests',
      'resource exhausted',
      'insufficient quota'
    ];
    return retryablePatterns.some(pattern => message.includes(pattern));
  }
  return false;
}

export function isModelSpecificError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const modelErrorPatterns = [
      'model not found',
      'unsupported model',
      'unknown model',
      'invalid model',
      'model requires verification',
      'model requires additional terms',
      'model not yet available',
      'not found model'
    ];
    return modelErrorPatterns.some(pattern => message.includes(pattern));
  }
  return false;
}

export function shouldRotateModel(error: unknown): boolean {
  if (isModelSpecificError(error)) {
    return true;
  }
  return isRetryableError(error);
}

export function getNextModelIndex(
  currentModelIndex: number,
  availableModels: ModelConfig[]
): number {
  const nextIndex = currentModelIndex + 1;
  if (nextIndex >= availableModels.length) {
    return -1;
  }
  return nextIndex;
}

export function getFallbackModelForTask(
  task: 'analyze' | 'categorize' | 'general',
  excludeProvider?: ModelProvider
): ModelConfig | null {
  const models = getAvailableModelsForTask(task);
  if (excludeProvider) {
    const fallback = models.find(m => m.provider !== excludeProvider);
    return fallback || null;
  }
  return models[0] || null;
}

export function getAllQuotaTypes(): string[] {
  return ['anthropic', 'antigravity', 'gemini-cli', 'opencode', 'gitlab', 'combined'];
}

export function getModelsByQuotaType(quotaType: string): ModelConfig[] {
  return MODEL_ROTATION_ORDER.filter(m => m.quotaType === quotaType);
}

export function getAnyAvailableModel(task: 'analyze' | 'categorize' | 'general'): ModelConfig | null {
  const available = getAvailableModelsForTask(task);
  if (available.length > 0) return available[0];

  MODEL_QUOTA_STATUS.clear();
  const fallback = MODEL_ROTATION_ORDER.filter(m => m.capabilities.includes(task));
  return fallback[0] || null;
}

export function getSdkModelName(configName: string): string {
  const model = MODEL_ROTATION_ORDER.find(m => m.name === configName);
  if (model) {
    return model.sdkModelName;
  }
  return configName;
}
