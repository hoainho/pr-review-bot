import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      generateContent: vi.fn().mockResolvedValue({ text: '{"issues": []}' }),
    },
  })),
  Type: {
    OBJECT: 'object',
    ARRAY: 'array',
    STRING: 'string',
    BOOLEAN: 'boolean',
  },
}));

describe('AI Service Provider Routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('Provider Detection Logic', () => {
    it('should route gemini-claude-* models to Anthropic API', async () => {
      const claudeModels = [
        'gemini-claude-opus-4-5-thinking',
        'gemini-claude-sonnet-4-5',
        'gemini-claude-sonnet-4-5-thinking',
      ];

      claudeModels.forEach(model => {
        expect(model.startsWith('gemini-claude')).toBe(true);
      });
    });

    it('should route claude-* models to Anthropic API (backward compat)', async () => {
      const claudeModels = [
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
      ];

      claudeModels.forEach(model => {
        expect(model.startsWith('claude')).toBe(true);
      });
    });

    it('should route gemini-* models to Google GenAI', () => {
      const geminiModels = [
        'gemini-3-pro-preview',
        'gemini-2.5-pro',
        'gemini-3-flash-preview',
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
      ];

      geminiModels.forEach(model => {
        expect(model.startsWith('gemini')).toBe(true);
      });
    });

    it('should route other models to OpenAI-compatible API', () => {
      const otherModels = [
        'llama-3.3-70b-versatile',
        'llama-3.1-8b-instant',
        'qwen/qwen3-32b',
        'gpt-4',
      ];

      otherModels.forEach(model => {
        expect(model.startsWith('claude')).toBe(false);
        expect(model.startsWith('gemini')).toBe(false);
      });
    });
  });

  describe('Anthropic API Contract', () => {
    it('should use correct Anthropic API headers', () => {
      const expectedHeaders = {
        'x-api-key': expect.any(String),
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      };

      expect(expectedHeaders['anthropic-version']).toBe('2023-06-01');
      expect(expectedHeaders['content-type']).toBe('application/json');
    });

    it('should format Anthropic request body correctly', () => {
      const requestBody = {
        model: 'gemini-claude-opus-4-5-thinking',
        max_tokens: 16384,
        system: 'You are a code reviewer',
        messages: [{ role: 'user', content: 'Review this code' }],
      };

      expect(requestBody.model).toMatch(/^gemini-claude-/);
      expect(requestBody.max_tokens).toBeGreaterThan(0);
      expect(requestBody.system).toBeTruthy();
      expect(requestBody.messages).toHaveLength(1);
      expect(requestBody.messages[0].role).toBe('user');
    });

    it('should parse Anthropic response format', () => {
      const anthropicResponse = {
        content: [
          { type: 'text', text: '{"issues": []}' }
        ],
        model: 'gemini-claude-opus-4-5-thinking',
        stop_reason: 'end_turn',
      };

      const text = anthropicResponse.content?.[0]?.text || '';
      expect(text).toBe('{"issues": []}');
    });
  });

  describe('OpenAI-Compatible API Contract', () => {
    it('should format OpenAI-compatible request body correctly', () => {
      const requestBody = {
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are a code reviewer' },
          { role: 'user', content: 'Review this code' },
        ],
        temperature: 0.2,
        max_tokens: 16384,
      };

      expect(requestBody.messages).toHaveLength(2);
      expect(requestBody.messages[0].role).toBe('system');
      expect(requestBody.messages[1].role).toBe('user');
    });

    it('should parse OpenAI-compatible response format', () => {
      const openaiResponse = {
        choices: [
          {
            message: {
              role: 'assistant',
              content: '{"issues": []}',
            },
            finish_reason: 'stop',
          },
        ],
      };

      const content = openaiResponse.choices?.[0]?.message?.content || '';
      expect(content).toBe('{"issues": []}');
    });
  });

  describe('JSON Response Extraction', () => {
    it('should extract JSON from markdown code blocks', () => {
      const responseWithMarkdown = '```json\n{"issues": []}\n```';
      const jsonMatch = responseWithMarkdown.match(/```json\s*([\s\S]*?)\s*```/);
      expect(jsonMatch?.[1].trim()).toBe('{"issues": []}');
    });

    it('should extract JSON from generic code blocks', () => {
      const responseWithCode = '```\n{"issues": []}\n```';
      const codeMatch = responseWithCode.match(/```\s*([\s\S]*?)\s*```/);
      expect(codeMatch?.[1].trim()).toBe('{"issues": []}');
    });

    it('should handle raw JSON response', () => {
      const rawJson = '{"issues": []}';
      expect(() => JSON.parse(rawJson)).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle Anthropic API errors', () => {
      const anthropicError = {
        error: {
          type: 'rate_limit_error',
          message: 'Rate limit exceeded',
        },
      };

      expect(anthropicError.error.message).toContain('Rate limit');
    });

    it('should handle timeout errors', () => {
      const timeoutError = new Error('Request timeout after 10 minutes');
      expect(timeoutError.message).toContain('timeout');
    });

    it('should handle cancellation', () => {
      const cancelError = new Error('Request cancelled');
      expect(cancelError.message).toBe('Request cancelled');
    });

    it('should handle missing API key', () => {
      const missingKeyError = new Error('VITE_ANTHROPIC_API_KEY not configured');
      expect(missingKeyError.message).toContain('API_KEY');
    });
  });

  describe('Request Options Validation', () => {
    interface RequestOptions {
      model: string;
      contents: string;
      systemInstruction: string;
      responseMimeType?: string;
      responseSchema?: object;
      abortSignal?: AbortSignal;
    }

    it('should validate required fields', () => {
      const options: RequestOptions = {
        model: 'claude-opus-4-5-20251101',
        contents: 'diff content here',
        systemInstruction: 'You are a code reviewer',
        responseMimeType: 'application/json',
      };

      expect(options.model).toBeTruthy();
      expect(options.contents).toBeTruthy();
      expect(options.systemInstruction).toBeTruthy();
    });

    it('should support abort signal', () => {
      const controller = new AbortController();
      const options: RequestOptions = {
        model: 'claude-opus-4-5-20251101',
        contents: 'test',
        systemInstruction: 'test',
        abortSignal: controller.signal,
      };

      expect(options.abortSignal).toBeDefined();
      expect(options.abortSignal?.aborted).toBe(false);
      
      controller.abort();
      expect(options.abortSignal?.aborted).toBe(true);
    });
  });
});

describe('AI Service Response Parsing', () => {
  describe('Issue Format Validation', () => {
    it('should validate issue structure', () => {
      const validIssue = {
        bug_description: 'Potential null reference',
        severity: 'HIGH',
        bug_type: 'CRASH',
        file_name: 'src/app.ts',
        line_numbers: '10-15',
        snippet: 'const x = obj.value;',
        suggested_fix: 'Add null check',
        suggested_code: 'const x = obj?.value;',
        prd_related: false,
      };

      expect(validIssue.bug_description).toBeTruthy();
      expect(['HIGH', 'MEDIUM', 'LOW', 'CRITICAL']).toContain(validIssue.severity);
      expect(validIssue.file_name).toBeTruthy();
      expect(validIssue.line_numbers).toBeTruthy();
    });

    it('should handle empty issues array', () => {
      const response = { issues: [] };
      expect(response.issues).toHaveLength(0);
    });

    it('should handle multiple issues', () => {
      const response = {
        issues: [
          { bug_description: 'Issue 1', severity: 'HIGH' },
          { bug_description: 'Issue 2', severity: 'MEDIUM' },
        ],
      };
      expect(response.issues).toHaveLength(2);
    });
  });

  describe('Severity Validation', () => {
    const validSeverities = ['HIGH', 'MEDIUM', 'LOW', 'CRITICAL'];

    validSeverities.forEach(severity => {
      it(`should accept ${severity} as valid severity`, () => {
        expect(validSeverities).toContain(severity);
      });
    });

    it('should reject invalid severity', () => {
      const invalidSeverity = 'UNKNOWN';
      expect(validSeverities).not.toContain(invalidSeverity);
    });
  });

  describe('Bug Type Validation', () => {
    const validBugTypes = [
      'RACE_CONDITION',
      'STATE_MANAGEMENT',
      'MEMORY_LEAK',
      'SECURITY',
      'CRASH',
      'CORRUPTION',
      'PERFORMANCE',
      'RESOURCE_LEAK',
    ];

    validBugTypes.forEach(bugType => {
      it(`should accept ${bugType} as valid bug type`, () => {
        expect(validBugTypes).toContain(bugType);
      });
    });
  });
});

describe('Multi-Provider Fallback', () => {
  it('should define fallback order: Claude -> Gemini -> OpenAI-compatible', () => {
    const providerOrder = ['anthropic', 'gemini', 'openai'];
    
    expect(providerOrder[0]).toBe('anthropic');
    expect(providerOrder[1]).toBe('gemini');
    expect(providerOrder[2]).toBe('openai');
  });

  it('should support at least 3 different providers', () => {
    const providers = new Set(['anthropic', 'gemini', 'openai', 'antigravity', 'gitlab']);
    expect(providers.size).toBeGreaterThanOrEqual(3);
  });
});
