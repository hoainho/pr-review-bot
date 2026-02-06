import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  parseGitHubUrl, 
  fetchPrDiff, 
  fetchPRInfoFromUrl,
  checkMergeConflicts,
  submitPrReview 
} from '../../services/githubService';

describe('githubService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('parseGitHubUrl', () => {
    it('should parse valid GitHub PR URL', () => {
      const url = 'https://github.com/owner/repo/pull/123';
      const result = parseGitHubUrl(url);
      
      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo',
        pullNumber: '123',
      });
    });

    it('should parse URL with trailing slash', () => {
      const url = 'https://github.com/my-org/my-repo/pull/456/';
      const result = parseGitHubUrl(url);
      
      expect(result).toEqual({
        owner: 'my-org',
        repo: 'my-repo',
        pullNumber: '456',
      });
    });

    it('should parse URL with additional path segments', () => {
      const url = 'https://github.com/owner/repo/pull/789/files';
      const result = parseGitHubUrl(url);
      
      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo',
        pullNumber: '789',
      });
    });

    it('should return null for invalid URL - missing pull number', () => {
      const url = 'https://github.com/owner/repo/pull/';
      const result = parseGitHubUrl(url);
      
      expect(result).toBeNull();
    });

    it('should return null for non-GitHub URL', () => {
      const url = 'https://gitlab.com/owner/repo/merge_requests/123';
      const result = parseGitHubUrl(url);
      
      expect(result).toBeNull();
    });

    it('should return null for GitHub URL without pull request', () => {
      const url = 'https://github.com/owner/repo/issues/123';
      const result = parseGitHubUrl(url);
      
      expect(result).toBeNull();
    });

    it('should handle URLs with query params', () => {
      const url = 'https://github.com/owner/repo/pull/123?diff=split';
      const result = parseGitHubUrl(url);
      
      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo',
        pullNumber: '123',
      });
    });
  });

  describe('fetchPrDiff', () => {
    it('should fetch diff successfully for small PR', async () => {
      const mockDiff = `diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,4 @@
 const x = 1;
+const y = 2;
 export { x };`;

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockDiff),
      } as Response);

      const result = await fetchPrDiff('https://github.com/owner/repo/pull/1', 'token123');
      
      expect(result).toBe(mockDiff);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/pulls/1',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'token token123',
            Accept: 'application/vnd.github.v3.diff',
          }),
        })
      );
    });

    it('should fallback to files API when diff exceeds 300 files', async () => {
      const mockFiles = [
        {
          sha: 'abc123',
          filename: 'src/file1.ts',
          status: 'modified',
          additions: 10,
          deletions: 5,
          changes: 15,
          patch: '@@ -1,3 +1,4 @@\n const x = 1;\n+const y = 2;',
        },
        {
          sha: 'def456',
          filename: 'src/file2.ts',
          status: 'added',
          additions: 20,
          deletions: 0,
          changes: 20,
          patch: '@@ -0,0 +1,5 @@\n+export const newFunc = () => {};',
        },
      ];

      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: false,
          status: 406,
          json: () => Promise.resolve({
            message: 'Sorry, the diff exceeded the maximum number of files',
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockFiles),
        } as Response);

      const progressMessages: string[] = [];
      const result = await fetchPrDiff(
        'https://github.com/owner/repo/pull/1', 
        'token123',
        (msg) => progressMessages.push(msg)
      );

      expect(result).toContain('diff --git');
      expect(result).toContain('src/file1.ts');
      expect(result).toContain('src/file2.ts');
      expect(progressMessages).toContain('PR exceeds 300 files limit. Using paginated files API...');
    });

    it('should throw error for invalid URL', async () => {
      await expect(
        fetchPrDiff('invalid-url', 'token123')
      ).rejects.toThrow('Invalid GitHub PR URL');
    });

    it('should throw error on API failure', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ message: 'Bad credentials' }),
      } as Response);

      await expect(
        fetchPrDiff('https://github.com/owner/repo/pull/1', 'bad-token')
      ).rejects.toThrow('Bad credentials');
    });
  });

  describe('fetchPRInfoFromUrl', () => {
    it('should fetch PR info successfully', async () => {
      const mockPRData = {
        title: 'Add new feature',
        body: 'This PR adds a new feature',
        base: { ref: 'main', sha: 'base123' },
        head: { ref: 'feature-branch', sha: 'head456' },
        state: 'open',
        mergeable: true,
        mergeable_state: 'clean',
        merged: false,
        additions: 100,
        deletions: 50,
        changed_files: 10,
        user: { login: 'developer' },
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPRData),
      } as Response);

      const result = await fetchPRInfoFromUrl(
        'https://github.com/owner/repo/pull/123',
        'token123'
      );

      expect(result).toMatchObject({
        owner: 'owner',
        repo: 'repo',
        pullNumber: 123,
        title: 'Add new feature',
        description: 'This PR adds a new feature',
        baseBranch: 'main',
        sourceBranch: 'feature-branch',
        state: 'open',
        mergeable: true,
        additions: 100,
        deletions: 50,
        changedFiles: 10,
        author: 'developer',
      });
    });

    it('should handle missing optional fields', async () => {
      const mockPRData = {
        base: {},
        head: {},
        user: {},
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPRData),
      } as Response);

      const result = await fetchPRInfoFromUrl(
        'https://github.com/owner/repo/pull/1',
        'token'
      );

      expect(result.title).toBe('');
      expect(result.description).toBe('');
      expect(result.baseBranch).toBe('main');
      expect(result.sourceBranch).toBe('unknown');
      expect(result.author).toBe('unknown');
    });
  });

  describe('checkMergeConflicts', () => {
    it('should detect no conflicts when mergeable is true', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          mergeable: true,
          mergeable_state: 'clean',
          merged: false,
        }),
      } as Response);

      const result = await checkMergeConflicts(
        'https://github.com/owner/repo/pull/1',
        'token'
      );

      expect(result.hasConflicts).toBe(false);
      expect(result.conflictDetails).toContain('clean');
    });

    it('should detect conflicts when mergeable is false', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          mergeable: false,
          mergeable_state: 'dirty',
          merged: false,
        }),
      } as Response);

      const result = await checkMergeConflicts(
        'https://github.com/owner/repo/pull/1',
        'token'
      );

      expect(result.hasConflicts).toBe(true);
    });

    it('should handle already merged PR', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          merged: true,
        }),
      } as Response);

      const result = await checkMergeConflicts(
        'https://github.com/owner/repo/pull/1',
        'token'
      );

      expect(result.hasConflicts).toBe(false);
      expect(result.conflictDetails).toContain('already merged');
    });
  });

  describe('submitPrReview', () => {
    it('should submit review successfully', async () => {
      let callCount = 0;
      vi.mocked(global.fetch).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: true,
            json: () => Promise.resolve([
              { filename: 'src/db.ts', patch: '@@ -1,20 +1,20 @@\n context' },
            ]),
          } as Response;
        }
        return {
          ok: true,
          json: () => Promise.resolve({ id: 123 }),
        } as Response;
      });

      const issues = [
        {
          severity: 'HIGH',
          bug_type: 'SECURITY',
          bug_description: 'SQL injection vulnerability',
          suggested_fix: 'Use parameterized queries',
          suggested_code: 'db.query("SELECT * FROM users WHERE id = ?", [id])',
          file_name: 'src/db.ts',
          line_numbers: '10-15',
        },
      ];

      const result = await submitPrReview(
        'https://github.com/owner/repo/pull/1',
        'token',
        issues,
        'NhoNH'
      );

      expect(result.posted).toBeGreaterThanOrEqual(0);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/pulls/1/reviews',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should throw error on submission failure', async () => {
      let callCount = 0;
      vi.mocked(global.fetch).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: true,
            json: () => Promise.resolve([]),
          } as Response;
        }
        return {
          ok: false,
          statusText: 'Forbidden',
          json: () => Promise.resolve({ message: 'Resource not accessible' }),
        } as Response;
      });

      await expect(
        submitPrReview(
          'https://github.com/owner/repo/pull/1',
          'token',
          [],
          'NhoNH'
        )
      ).rejects.toThrow('Resource not accessible');
    });
  });
});
