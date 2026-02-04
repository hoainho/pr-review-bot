import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchPrDiff } from '../../services/githubService';

describe('Large PR Handling (Integration)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('Paginated Files API Fallback', () => {
    it('should handle PR with 300+ files using pagination', async () => {
      const generateFiles = (count: number, startIndex: number = 0) => {
        return Array.from({ length: count }, (_, i) => ({
          sha: `sha${startIndex + i}`,
          filename: `src/file${startIndex + i}.ts`,
          status: 'modified' as const,
          additions: 10,
          deletions: 5,
          changes: 15,
          patch: `@@ -1,3 +1,4 @@\n const x${startIndex + i} = 1;\n+const y${startIndex + i} = 2;`,
        }));
      };

      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: false,
          status: 406,
          json: () => Promise.resolve({
            message: 'Sorry, the diff exceeded the maximum number of files (300)',
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(generateFiles(100, 0)),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(generateFiles(100, 100)),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(generateFiles(100, 200)),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(generateFiles(50, 300)),
        } as Response);

      const progressMessages: string[] = [];
      const result = await fetchPrDiff(
        'https://github.com/owner/repo/pull/1',
        'token',
        (msg) => progressMessages.push(msg)
      );

      expect(result).toContain('diff --git');
      expect(result).toContain('src/file0.ts');
      expect(result).toContain('src/file349.ts');
      
      expect(progressMessages).toContain('PR exceeds 300 files limit. Using paginated files API...');
      expect(progressMessages.some(m => m.includes('350 files'))).toBe(true);
    });

    it('should handle empty patch for binary files', async () => {
      const filesWithBinary = [
        {
          sha: 'abc123',
          filename: 'image.png',
          status: 'added' as const,
          additions: 0,
          deletions: 0,
          changes: 0,
        },
        {
          sha: 'def456',
          filename: 'src/code.ts',
          status: 'modified' as const,
          additions: 5,
          deletions: 2,
          changes: 7,
          patch: '@@ -1 +1 @@\n-old\n+new',
        },
      ];

      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: false,
          status: 406,
          json: () => Promise.resolve({ message: 'Too large' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(filesWithBinary),
        } as Response);

      const result = await fetchPrDiff(
        'https://github.com/owner/repo/pull/1',
        'token'
      );

      expect(result).toContain('image.png');
      expect(result).toContain('src/code.ts');
      expect(result).toContain('Binary file');
    });

    it('should handle renamed files correctly', async () => {
      const renamedFile = [{
        sha: 'abc123',
        filename: 'src/newName.ts',
        previous_filename: 'src/oldName.ts',
        status: 'renamed' as const,
        additions: 5,
        deletions: 2,
        changes: 7,
        patch: '@@ -1,3 +1,4 @@\n const x = 1;\n+const y = 2;\n export { x };',
      }];

      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: false,
          status: 406,
          json: () => Promise.resolve({ message: 'Too large' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(renamedFile),
        } as Response);

      const result = await fetchPrDiff(
        'https://github.com/owner/repo/pull/1',
        'token'
      );

      expect(result).toContain('src/newName.ts');
      expect(result).toContain('rename from src/oldName.ts');
      expect(result).toContain('rename to src/newName.ts');
    });

    it('should handle added files correctly', async () => {
      const addedFile = [{
        sha: 'abc123',
        filename: 'src/newFile.ts',
        status: 'added' as const,
        additions: 10,
        deletions: 0,
        changes: 10,
        patch: '@@ -0,0 +1,10 @@\n+line1\n+line2',
      }];

      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: false,
          status: 406,
          json: () => Promise.resolve({ message: 'Too large' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(addedFile),
        } as Response);

      const result = await fetchPrDiff(
        'https://github.com/owner/repo/pull/1',
        'token'
      );

      expect(result).toContain('new file mode');
      expect(result).toContain('--- /dev/null');
      expect(result).toContain('+++ b/src/newFile.ts');
    });

    it('should handle deleted files correctly', async () => {
      const deletedFile = [{
        sha: 'abc123',
        filename: 'src/oldFile.ts',
        status: 'removed' as const,
        additions: 0,
        deletions: 20,
        changes: 20,
        patch: '@@ -1,20 +0,0 @@\n-line1\n-line2',
      }];

      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: false,
          status: 406,
          json: () => Promise.resolve({ message: 'Too large' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(deletedFile),
        } as Response);

      const result = await fetchPrDiff(
        'https://github.com/owner/repo/pull/1',
        'token'
      );

      expect(result).toContain('deleted file mode');
      expect(result).toContain('--- a/src/oldFile.ts');
      expect(result).toContain('+++ /dev/null');
    });
  });

  describe('Rate Limiting', () => {
    it('should add delay between pagination requests', async () => {
      const startTime = Date.now();
      
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: false,
          status: 406,
          json: () => Promise.resolve({ message: 'Too large' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(Array(100).fill({
            sha: 'a',
            filename: 'f1.ts',
            status: 'modified',
            patch: '@@ -1 +1 @@\n-a\n+b',
          })),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(Array(100).fill({
            sha: 'b',
            filename: 'f2.ts',
            status: 'modified',
            patch: '@@ -1 +1 @@\n-c\n+d',
          })),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        } as Response);

      await fetchPrDiff('https://github.com/owner/repo/pull/1', 'token');

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors during pagination gracefully', async () => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: false,
          status: 406,
          json: () => Promise.resolve({ message: 'Too large' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
          json: () => Promise.resolve({ message: 'Rate limit exceeded' }),
        } as Response);

      await expect(
        fetchPrDiff('https://github.com/owner/repo/pull/1', 'token')
      ).rejects.toThrow('Rate limit exceeded');
    });

    it('should handle network errors', async () => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: false,
          status: 406,
          json: () => Promise.resolve({ message: 'Too large' }),
        } as Response)
        .mockRejectedValueOnce(new Error('Network error'));

      await expect(
        fetchPrDiff('https://github.com/owner/repo/pull/1', 'token')
      ).rejects.toThrow('Network error');
    });
  });
});
