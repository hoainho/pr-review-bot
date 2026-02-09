import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MODEL_ROTATION_ORDER,
  ModelConfig,
  ModelProvider,
  getAvailableModelsForTask,
  isQuotaAvailable,
  markModelQuotaExhausted,
  clearModelQuotaStatus,
  clearAllQuotaExhaustion,
  isRetryableError,
  isModelSpecificError,
  shouldRotateModel,
  getNextModelIndex,
  getFallbackModelForTask,
  getAllQuotaTypes,
  getModelsByQuotaType,
  getAnyAvailableModel,
  getSdkModelName,
} from '../../services/modelRotation';

describe('Model Rotation Service', () => {
  beforeEach(() => {
    clearAllQuotaExhaustion();
  });

  describe('MODEL_ROTATION_ORDER Configuration', () => {
    it('should have at least one model configured', () => {
      expect(MODEL_ROTATION_ORDER.length).toBeGreaterThan(0);
    });

    it('should have Claude models as highest priority (1-3)', () => {
      const claudeModels = MODEL_ROTATION_ORDER.filter(m => m.provider === 'anthropic');
      expect(claudeModels.length).toBeGreaterThanOrEqual(3);
      
      const priorities = claudeModels.map(m => m.priority).sort((a, b) => (a || 0) - (b || 0));
      expect(priorities[0]).toBe(1);
      expect(priorities[1]).toBe(2);
      expect(priorities[2]).toBe(3);
    });

    it('should have Claude models with gemini-claude prefix for proxy compatibility', () => {
      const claudeModels = MODEL_ROTATION_ORDER.filter(m => m.provider === 'anthropic');
      claudeModels.forEach(model => {
        expect(model.sdkModelName.startsWith('gemini-claude')).toBe(true);
      });
    });

    it('should have GPT models after Claude (priority 4-8)', () => {
      const gptModels = MODEL_ROTATION_ORDER.filter(m => m.sdkModelName.startsWith('gpt-'));
      expect(gptModels.length).toBeGreaterThanOrEqual(3);
      
      gptModels.forEach(model => {
        expect(model.priority).toBeGreaterThanOrEqual(4);
        expect(model.priority).toBeLessThanOrEqual(8);
      });
    });

    it('should have Gemini models after GPT (priority 9+)', () => {
      const geminiModels = MODEL_ROTATION_ORDER.filter(m => m.provider === 'gemini');
      geminiModels.forEach(model => {
        expect(model.priority).toBeGreaterThanOrEqual(9);
      });
    });

    it('should have all required fields for each model', () => {
      MODEL_ROTATION_ORDER.forEach((model, index) => {
        expect(model.name, `Model ${index} missing name`).toBeTruthy();
        expect(model.displayName, `Model ${model.name} missing displayName`).toBeTruthy();
        expect(model.sdkModelName, `Model ${model.name} missing sdkModelName`).toBeTruthy();
        expect(model.provider, `Model ${model.name} missing provider`).toBeTruthy();
        expect(model.capabilities, `Model ${model.name} missing capabilities`).toBeDefined();
        expect(model.capabilities.length, `Model ${model.name} has empty capabilities`).toBeGreaterThan(0);
      });
    });

    it('should have unique model names', () => {
      const names = MODEL_ROTATION_ORDER.map(m => m.name);
      const uniqueNames = [...new Set(names)];
      expect(names.length).toBe(uniqueNames.length);
    });

    it('should have unique priorities', () => {
      const priorities = MODEL_ROTATION_ORDER.map(m => m.priority).filter(p => p !== undefined);
      const uniquePriorities = [...new Set(priorities)];
      expect(priorities.length).toBe(uniquePriorities.length);
    });

    it('should have valid provider values', () => {
      const validProviders: ModelProvider[] = ['antigravity', 'gemini', 'opencode', 'anthropic', 'openai', 'gitlab'];
      MODEL_ROTATION_ORDER.forEach(model => {
        expect(validProviders).toContain(model.provider);
      });
    });

    it('should have valid capability values', () => {
      const validCapabilities = ['analyze', 'categorize', 'general'];
      MODEL_ROTATION_ORDER.forEach(model => {
        model.capabilities.forEach(cap => {
          expect(validCapabilities).toContain(cap);
        });
      });
    });

    it('should have positive contextWindow values when defined', () => {
      MODEL_ROTATION_ORDER.forEach(model => {
        if (model.contextWindow !== undefined) {
          expect(model.contextWindow).toBeGreaterThan(0);
        }
      });
    });

    it('should have positive maxOutputTokens values when defined', () => {
      MODEL_ROTATION_ORDER.forEach(model => {
        if (model.maxOutputTokens !== undefined) {
          expect(model.maxOutputTokens).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Provider Coverage', () => {
    it('should have Anthropic (Claude) models', () => {
      const anthropicModels = MODEL_ROTATION_ORDER.filter(m => m.provider === 'anthropic');
      expect(anthropicModels.length).toBeGreaterThan(0);
    });

    it('should have Gemini models', () => {
      const geminiModels = MODEL_ROTATION_ORDER.filter(m => m.provider === 'gemini');
      expect(geminiModels.length).toBeGreaterThan(0);
    });

    it('should have OpenAI-compatible models (Llama, Qwen)', () => {
      const openaiModels = MODEL_ROTATION_ORDER.filter(m => m.provider === 'openai');
      expect(openaiModels.length).toBeGreaterThan(0);
    });

    it('should have Claude sdkModelName starting with "gemini-claude" for proxy', () => {
      const anthropicModels = MODEL_ROTATION_ORDER.filter(m => m.provider === 'anthropic');
      anthropicModels.forEach(model => {
        expect(model.sdkModelName.startsWith('gemini-claude')).toBe(true);
      });
    });

    it('should have Gemini sdkModelName starting with "gemini"', () => {
      const geminiModels = MODEL_ROTATION_ORDER.filter(m => m.provider === 'gemini');
      geminiModels.forEach(model => {
        expect(model.sdkModelName.startsWith('gemini')).toBe(true);
      });
    });
  });

  describe('Model Priority Order', () => {
    it('should return models sorted by priority', () => {
      const models = getAvailableModelsForTask('analyze');
      for (let i = 0; i < models.length - 1; i++) {
        const currentPriority = models[i].priority || 100;
        const nextPriority = models[i + 1].priority || 100;
        expect(currentPriority).toBeLessThanOrEqual(nextPriority);
      }
    });

    it('should return Claude Opus Thinking as first model for analyze task', () => {
      const models = getAvailableModelsForTask('analyze');
      expect(models[0].name).toBe('claude-opus-4-5-thinking');
    });
  });

  describe('Quota Management', () => {
    it('should return true for quota available on fresh model', () => {
      expect(isQuotaAvailable('claude-opus-4-5')).toBe(true);
    });

    it('should return false after marking quota exhausted', () => {
      markModelQuotaExhausted('claude-opus-4-5');
      expect(isQuotaAvailable('claude-opus-4-5')).toBe(false);
    });

    it('should return true after clearing quota status', () => {
      markModelQuotaExhausted('claude-opus-4-5');
      clearModelQuotaStatus('claude-opus-4-5');
      expect(isQuotaAvailable('claude-opus-4-5')).toBe(true);
    });

    it('should clear all quota statuses', () => {
      markModelQuotaExhausted('claude-opus-4-5');
      markModelQuotaExhausted('gemini-3-pro-preview');
      clearAllQuotaExhaustion();
      expect(isQuotaAvailable('claude-opus-4-5')).toBe(true);
      expect(isQuotaAvailable('gemini-3-pro-preview')).toBe(true);
    });

    it('should exclude exhausted models from available list', () => {
      markModelQuotaExhausted('claude-opus-4-5');
      const models = getAvailableModelsForTask('analyze');
      expect(models.find(m => m.name === 'claude-opus-4-5')).toBeUndefined();
    });
  });

  describe('Error Classification', () => {
    describe('isRetryableError', () => {
      const retryableMessages = [
        'rate limit exceeded',
        'quota exhausted',
        'temporarily unavailable',
        'server overloaded',
        'HTTP 503',
        'HTTP 429',
        'request timeout',
        'network error',
        'ECONNRESET',
        'ETIMEDOUT',
        'socket hang up',
        'empty response',
        'model overloaded',
        'please try again',
        'please retry',
        'too many requests',
        'resource exhausted',
        'insufficient quota',
      ];

      retryableMessages.forEach(msg => {
        it(`should classify "${msg}" as retryable`, () => {
          expect(isRetryableError(new Error(msg))).toBe(true);
        });
      });

      it('should not classify normal errors as retryable', () => {
        expect(isRetryableError(new Error('Invalid JSON response'))).toBe(false);
        expect(isRetryableError(new Error('Authentication failed'))).toBe(false);
      });

      it('should return false for non-Error values', () => {
        expect(isRetryableError('string error')).toBe(false);
        expect(isRetryableError(null)).toBe(false);
        expect(isRetryableError(undefined)).toBe(false);
      });
    });

    describe('isModelSpecificError', () => {
      const modelErrors = [
        'model not found',
        'unsupported model',
        'unknown model',
        'invalid model',
        'model requires verification',
        'model requires additional terms',
        'model not yet available',
        'not found model',
      ];

      modelErrors.forEach(msg => {
        it(`should classify "${msg}" as model-specific`, () => {
          expect(isModelSpecificError(new Error(msg))).toBe(true);
        });
      });

      it('should not classify rate limit as model-specific', () => {
        expect(isModelSpecificError(new Error('rate limit exceeded'))).toBe(false);
      });
    });

    describe('shouldRotateModel', () => {
      it('should rotate on model-specific errors', () => {
        expect(shouldRotateModel(new Error('model not found'))).toBe(true);
      });

      it('should rotate on retryable errors', () => {
        expect(shouldRotateModel(new Error('rate limit exceeded'))).toBe(true);
      });

      it('should not rotate on authentication errors', () => {
        expect(shouldRotateModel(new Error('invalid api key'))).toBe(false);
      });
    });
  });

  describe('Model Navigation', () => {
    it('should return next index correctly', () => {
      const models = getAvailableModelsForTask('analyze');
      expect(getNextModelIndex(0, models)).toBe(1);
      expect(getNextModelIndex(1, models)).toBe(2);
    });

    it('should return -1 when no more models', () => {
      const models = getAvailableModelsForTask('analyze');
      expect(getNextModelIndex(models.length - 1, models)).toBe(-1);
    });
  });

  describe('Fallback Logic', () => {
    it('should get fallback model for task', () => {
      const fallback = getFallbackModelForTask('analyze');
      expect(fallback).not.toBeNull();
    });

    it('should exclude specified provider', () => {
      const fallback = getFallbackModelForTask('analyze', 'anthropic');
      expect(fallback?.provider).not.toBe('anthropic');
    });

    it('should return null when all providers excluded', () => {
      MODEL_ROTATION_ORDER.forEach(m => markModelQuotaExhausted(m.name));
      clearAllQuotaExhaustion();
      
      const anthropicOnly = MODEL_ROTATION_ORDER.filter(m => m.provider !== 'anthropic');
      anthropicOnly.forEach(m => markModelQuotaExhausted(m.name));
      
      const fallback = getFallbackModelForTask('analyze', 'anthropic');
      expect(fallback).toBeNull();
    });
  });

  describe('Quota Types', () => {
    it('should return all quota types including anthropic', () => {
      const types = getAllQuotaTypes();
      expect(types).toContain('anthropic');
      expect(types).toContain('antigravity');
      expect(types).toContain('gemini-cli');
      expect(types).toContain('opencode');
    });

    it('should get models by quota type', () => {
      const anthropicModels = getModelsByQuotaType('anthropic');
      expect(anthropicModels.length).toBeGreaterThan(0);
      anthropicModels.forEach(m => {
        expect(m.quotaType).toBe('anthropic');
      });
    });
  });

  describe('getAnyAvailableModel', () => {
    it('should return first available model', () => {
      const model = getAnyAvailableModel('analyze');
      expect(model).not.toBeNull();
      expect(model?.name).toBe('claude-opus-4-5-thinking');
    });

    it('should clear quota and return model when all exhausted', () => {
      MODEL_ROTATION_ORDER.forEach(m => markModelQuotaExhausted(m.name));
      const model = getAnyAvailableModel('analyze');
      expect(model).not.toBeNull();
    });
  });

  describe('getSdkModelName', () => {
    it('should return correct SDK model name', () => {
      expect(getSdkModelName('claude-opus-4-5-thinking')).toBe('gemini-claude-opus-4-5-thinking');
      expect(getSdkModelName('gemini-3-pro-preview')).toBe('gemini-3-pro-preview');
    });

    it('should return input if model not found', () => {
      expect(getSdkModelName('unknown-model')).toBe('unknown-model');
    });
  });

  describe('Task Capabilities', () => {
    it('should have models for analyze task', () => {
      const models = getAvailableModelsForTask('analyze');
      expect(models.length).toBeGreaterThan(0);
    });

    it('should have models for categorize task', () => {
      const models = getAvailableModelsForTask('categorize');
      expect(models.length).toBeGreaterThan(0);
    });

    it('should have models for general task', () => {
      const models = getAvailableModelsForTask('general');
      expect(models.length).toBeGreaterThan(0);
    });

    it('all models should support all three tasks', () => {
      MODEL_ROTATION_ORDER.forEach(model => {
        expect(model.capabilities).toContain('analyze');
        expect(model.capabilities).toContain('categorize');
        expect(model.capabilities).toContain('general');
      });
    });
  });
});

describe('Model Configuration Contracts', () => {
  it('Claude models should have 200K context window', () => {
    const claudeModels = MODEL_ROTATION_ORDER.filter(m => m.provider === 'anthropic');
    claudeModels.forEach(model => {
      expect(model.contextWindow).toBe(200000);
    });
  });

  it('Gemini models should have 1M+ context window', () => {
    const geminiModels = MODEL_ROTATION_ORDER.filter(m => m.provider === 'gemini');
    geminiModels.forEach(model => {
      expect(model.contextWindow).toBeGreaterThanOrEqual(1048576);
    });
  });

  it('should maintain backward compatibility - all existing model names preserved', () => {
    const requiredModels = [
      'gemini-3-pro-preview',
      'gemini-2.5-pro',
      'gemini-3-flash-preview',
      'gemini-2.5-flash',
      'llama-3.3-70b-versatile',
    ];
    
    requiredModels.forEach(name => {
      const model = MODEL_ROTATION_ORDER.find(m => m.name === name);
      expect(model, `Missing required model: ${name}`).toBeDefined();
    });
  });

  it('should have Claude Opus 4.5 Thinking with correct SDK model name', () => {
    const opus = MODEL_ROTATION_ORDER.find(m => m.name === 'claude-opus-4-5-thinking');
    expect(opus).toBeDefined();
    expect(opus?.sdkModelName).toBe('gemini-claude-opus-4-5-thinking');
  });

  it('should have Claude Sonnet 4.5 with correct SDK model name', () => {
    const sonnet = MODEL_ROTATION_ORDER.find(m => m.name === 'claude-sonnet-4-5');
    expect(sonnet).toBeDefined();
    expect(sonnet?.sdkModelName).toBe('gemini-claude-sonnet-4-5');
  });

  it('should have Claude Sonnet 4.5 Thinking with correct SDK model name', () => {
    const sonnetThinking = MODEL_ROTATION_ORDER.find(m => m.name === 'claude-sonnet-4-5-thinking');
    expect(sonnetThinking).toBeDefined();
    expect(sonnetThinking?.sdkModelName).toBe('gemini-claude-sonnet-4-5-thinking');
  });
});
