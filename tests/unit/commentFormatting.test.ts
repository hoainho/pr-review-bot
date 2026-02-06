import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitPrReview } from '../../services/githubService';

function mockFetchForReview(onReviewCall: (body: string) => void) {
  let callCount = 0;
  vi.mocked(global.fetch).mockImplementation(async (url, options) => {
    callCount++;
    if (callCount === 1) {
      return { 
        ok: true, 
        json: () => Promise.resolve([
          { filename: 'test.ts', patch: '@@ -1,10 +1,10 @@\n context' },
          { filename: 'a.ts', patch: '@@ -1,5 +1,5 @@\n context' },
          { filename: 'b.ts', patch: '@@ -1,5 +2,5 @@\n context' },
          { filename: 'c.ts', patch: '@@ -1,5 +3,5 @@\n context' },
          { filename: 'd.ts', patch: '@@ -1,5 +4,5 @@\n context' },
        ]) 
      } as Response;
    }
    onReviewCall((options as RequestInit).body as string);
    return { ok: true, json: () => Promise.resolve({}) } as Response;
  });
}

describe('Comment Formatting - Template C (Human Conversational)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('Individual Comment Format', () => {
    it('should format HIGH severity comment correctly', async () => {
      let capturedBody = '';
      mockFetchForReview((body) => { capturedBody = body; });

      const issues = [{
        severity: 'HIGH',
        bug_type: 'SECURITY',
        bug_description: 'SQL injection vulnerability detected',
        suggested_fix: 'Use parameterized queries',
        suggested_code: 'db.query("?", [id])',
        file_name: 'test.ts',
        line_numbers: '10',
      }];

      await submitPrReview('https://github.com/o/r/pull/1', 'token', issues, 'NhoNH');

      expect(capturedBody).toContain('High Severity - Security');
      expect(capturedBody).toContain('SQL injection vulnerability detected');
      expect(capturedBody).toContain('Consider use parameterized queries');
      expect(capturedBody).toContain('Reviewed by NhoNH');
    });

    it('should format MEDIUM severity comment correctly', async () => {
      let capturedBody = '';
      mockFetchForReview((body) => { capturedBody = body; });

      const issues = [{
        severity: 'MEDIUM',
        bug_type: 'PERFORMANCE',
        bug_description: 'Inefficient loop detected',
        suggested_fix: 'Using Map for O(1) lookups',
        suggested_code: 'const map = new Map()',
        file_name: 'test.ts',
        line_numbers: '20',
      }];

      await submitPrReview('https://github.com/o/r/pull/1', 'token', issues, 'NhoNH');

      expect(capturedBody).toContain('Medium Severity - Performance');
    });

    it('should format LOW severity comment correctly', async () => {
      let capturedBody = '';
      mockFetchForReview((body) => { capturedBody = body; });

      const issues = [{
        severity: 'LOW',
        bug_type: 'CODE_DUPLICATION',
        bug_description: 'Duplicated code block',
        suggested_fix: 'Extract to shared function',
        suggested_code: '',
        file_name: 'test.ts',
        line_numbers: '30',
      }];

      await submitPrReview('https://github.com/o/r/pull/1', 'token', issues, 'NhoNH');

      expect(capturedBody).toContain('Low Severity - Code Duplication');
    });

    it('should NOT contain any emoji characters', async () => {
      let capturedBody = '';
      mockFetchForReview((body) => { capturedBody = body; });

      const issues = [{
        severity: 'HIGH',
        bug_type: 'SECURITY',
        bug_description: 'Test issue',
        suggested_fix: 'Fix it',
        suggested_code: '',
        file_name: 'test.ts',
        line_numbers: '1',
      }];

      await submitPrReview('https://github.com/o/r/pull/1', 'token', issues, 'NhoNH');

      const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
      expect(emojiRegex.test(capturedBody)).toBe(false);
    });

    it('should include suggestion code block when provided', async () => {
      let capturedBody = '';
      mockFetchForReview((body) => { capturedBody = body; });

      const issues = [{
        severity: 'MEDIUM',
        bug_type: 'PERFORMANCE',
        bug_description: 'Test',
        suggested_fix: 'Fix',
        suggested_code: 'const optimized = true;',
        file_name: 'test.ts',
        line_numbers: '1',
      }];

      await submitPrReview('https://github.com/o/r/pull/1', 'token', issues, 'NhoNH');

      expect(capturedBody).toContain('```suggestion');
      expect(capturedBody).toContain('const optimized = true;');
    });

    it('should include horizontal rule separator', async () => {
      let capturedBody = '';
      mockFetchForReview((body) => { capturedBody = body; });

      const issues = [{
        severity: 'LOW',
        bug_type: 'PERFORMANCE',
        bug_description: 'Test',
        suggested_fix: 'Fix',
        suggested_code: '',
        file_name: 'test.ts',
        line_numbers: '1',
      }];

      await submitPrReview('https://github.com/o/r/pull/1', 'token', issues, 'NhoNH');

      expect(capturedBody).toContain('---');
    });
  });

  describe('Summary Comment Format', () => {
    it('should format summary with correct counts', async () => {
      let capturedBody = '';
      mockFetchForReview((body) => { capturedBody = body; });

      const issues = [
        { severity: 'HIGH', bug_type: 'SECURITY', bug_description: 'Issue 1', suggested_fix: 'Fix 1', suggested_code: '', file_name: 'a.ts', line_numbers: '1' },
        { severity: 'HIGH', bug_type: 'CRASH', bug_description: 'Issue 2', suggested_fix: 'Fix 2', suggested_code: '', file_name: 'b.ts', line_numbers: '2' },
        { severity: 'MEDIUM', bug_type: 'PERFORMANCE', bug_description: 'Issue 3', suggested_fix: 'Fix 3', suggested_code: '', file_name: 'c.ts', line_numbers: '3' },
        { severity: 'LOW', bug_type: 'CODE_DUPLICATION', bug_description: 'Issue 4', suggested_fix: 'Fix 4', suggested_code: '', file_name: 'd.ts', line_numbers: '4' },
      ];

      await submitPrReview('https://github.com/o/r/pull/1', 'token', issues, 'NhoNH');

      expect(capturedBody).toContain('PR Review Summary');
      expect(capturedBody).toContain('| **High** | 2 |');
      expect(capturedBody).toContain('| **Medium** | 1 |');
      expect(capturedBody).toContain('| **Low** | 1 |');
      expect(capturedBody).toContain('**Total:** 4 issues identified');
    });

    it('should include reviewer signature in summary', async () => {
      let capturedBody = '';
      mockFetchForReview((body) => { capturedBody = body; });

      await submitPrReview('https://github.com/o/r/pull/1', 'token', [], 'NhoNH');

      expect(capturedBody).toContain('Reviewed by NhoNH');
    });

    it('should NOT contain emoji in summary', async () => {
      let capturedBody = '';
      mockFetchForReview((body) => { capturedBody = body; });

      const issues = [
        { severity: 'HIGH', bug_type: 'SECURITY', bug_description: 'X', suggested_fix: 'Y', suggested_code: '', file_name: 'a.ts', line_numbers: '1' },
      ];

      await submitPrReview('https://github.com/o/r/pull/1', 'token', issues, 'NhoNH');

      expect(capturedBody).not.toContain('🔴');
      expect(capturedBody).not.toContain('🟡');
      expect(capturedBody).not.toContain('🟢');
    });
  });

  describe('Bug Type Labels', () => {
    const bugTypes = [
      { type: 'RACE_CONDITION', expected: 'Race Condition' },
      { type: 'STATE_MANAGEMENT', expected: 'State Management' },
      { type: 'MEMORY_LEAK', expected: 'Memory Leak' },
      { type: 'SECURITY', expected: 'Security' },
      { type: 'CRASH', expected: 'Crash Risk' },
      { type: 'CORRUPTION', expected: 'Data Corruption' },
      { type: 'PERFORMANCE', expected: 'Performance' },
      { type: 'RESOURCE_LEAK', expected: 'Resource Leak' },
    ];

    bugTypes.forEach(({ type, expected }) => {
      it(`should format ${type} as "${expected}"`, async () => {
        let capturedBody = '';
        mockFetchForReview((body) => { capturedBody = body; });

        const issues = [{
          severity: 'MEDIUM',
          bug_type: type,
          bug_description: 'Test',
          suggested_fix: 'Fix',
          suggested_code: '',
          file_name: 'test.ts',
          line_numbers: '1',
        }];

        await submitPrReview('https://github.com/o/r/pull/1', 'token', issues, 'NhoNH');

        expect(capturedBody).toContain(expected);
      });
    });
  });
});
