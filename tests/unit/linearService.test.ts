import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseLinearIssueIds,
  formatLinearContextForPrompt,
  isLinearContextConfigured,
  validateLinearApiKey,
  getLinearPriorityColor,
  getLinearStatusColor,
  LinearFetchResult,
  LinearContext,
} from '../../services/linearService';

describe('linearService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('parseLinearIssueIds', () => {
    it('should extract single Linear issue ID', () => {
      const text = 'Fix bug TEAM-123';
      const result = parseLinearIssueIds(text);
      
      expect(result).toEqual(['TEAM-123']);
    });

    it('should extract multiple Linear issue IDs', () => {
      const text = 'Implements PROJ-456 and fixes ENG-789';
      const result = parseLinearIssueIds(text);
      
      expect(result).toEqual(['PROJ-456', 'ENG-789']);
    });

    it('should remove duplicate issue IDs', () => {
      const text = 'TEAM-123 mentioned twice TEAM-123';
      const result = parseLinearIssueIds(text);
      
      expect(result).toEqual(['TEAM-123']);
    });

    it('should handle issue IDs with long team names', () => {
      const text = 'INFRA-1234 is a valid ID';
      const result = parseLinearIssueIds(text);
      
      expect(result).toEqual(['INFRA-1234']);
    });

    it('should return empty array when no issue IDs found', () => {
      const text = 'This text has no Linear issue IDs';
      const result = parseLinearIssueIds(text);
      
      expect(result).toEqual([]);
    });

    it('should not match lowercase patterns', () => {
      const text = 'team-123 is lowercase';
      const result = parseLinearIssueIds(text);
      
      expect(result).toEqual([]);
    });

    it('should extract IDs from PR title format', () => {
      const text = '[FEAT-100] Add new feature\n\nThis PR implements feature described in FEAT-100';
      const result = parseLinearIssueIds(text);
      
      expect(result).toEqual(['FEAT-100']);
    });

    it('should handle IDs in diff content', () => {
      const diff = `diff --git a/file.ts b/file.ts
+// Fixes BUG-42
+const x = 1;`;
      const result = parseLinearIssueIds(diff);
      
      expect(result).toEqual(['BUG-42']);
    });
  });

  describe('formatLinearContextForPrompt', () => {
    it('should format single issue correctly', () => {
      const result: LinearFetchResult = {
        issues: [{
          id: 'uuid-1',
          identifier: 'TEAM-123',
          title: 'Fix authentication bug',
          description: 'Users are unable to login',
          status: 'In Progress',
          priority: '2',
          priorityLabel: 'High',
          labels: ['bug', 'auth'],
          url: 'https://linear.app/team/issue/TEAM-123',
          teamName: 'Engineering',
          projectName: 'Auth System',
          estimate: 3,
        }],
        issueIdsFound: ['TEAM-123'],
        errors: [],
      };

      const formatted = formatLinearContextForPrompt(result);

      expect(formatted).toContain('LINEAR ISSUE CONTEXT');
      expect(formatted).toContain('TEAM-123');
      expect(formatted).toContain('Fix authentication bug');
      expect(formatted).toContain('In Progress');
      expect(formatted).toContain('High');
      expect(formatted).toContain('Engineering');
      expect(formatted).toContain('Auth System');
      expect(formatted).toContain('bug, auth');
      expect(formatted).toContain('3 points');
    });

    it('should return no context message for empty results', () => {
      const result: LinearFetchResult = {
        issues: [],
        issueIdsFound: [],
        errors: [],
      };

      const formatted = formatLinearContextForPrompt(result);

      expect(formatted).toContain('No Linear issue context available');
    });

    it('should handle issue without optional fields', () => {
      const result: LinearFetchResult = {
        issues: [{
          id: 'uuid-2',
          identifier: 'PROJ-456',
          title: 'Simple task',
          description: 'Do something',
          status: 'Todo',
          priority: '0',
          priorityLabel: 'No priority',
          labels: [],
          url: 'https://linear.app/proj/issue/PROJ-456',
        }],
        issueIdsFound: ['PROJ-456'],
        errors: [],
      };

      const formatted = formatLinearContextForPrompt(result);

      expect(formatted).toContain('PROJ-456');
      expect(formatted).toContain('Simple task');
      expect(formatted).not.toContain('Team:');
      expect(formatted).not.toContain('Project:');
      expect(formatted).not.toContain('Labels:');
      expect(formatted).not.toContain('points');
    });

    it('should truncate long descriptions', () => {
      const longDescription = 'A'.repeat(500);
      const result: LinearFetchResult = {
        issues: [{
          id: 'uuid-3',
          identifier: 'LONG-1',
          title: 'Long description issue',
          description: longDescription,
          status: 'Backlog',
          priority: '1',
          priorityLabel: 'Urgent',
          labels: [],
          url: 'https://linear.app/long/issue/LONG-1',
        }],
        issueIdsFound: ['LONG-1'],
        errors: [],
      };

      const formatted = formatLinearContextForPrompt(result);

      expect(formatted).toContain('...');
      expect(formatted.length).toBeLessThan(longDescription.length + 200);
    });
  });

  describe('isLinearContextConfigured', () => {
    it('should return true for valid context', () => {
      const context: LinearContext = { apiKey: 'lin_api_test123' };
      expect(isLinearContextConfigured(context)).toBe(true);
    });

    it('should return false for undefined context', () => {
      expect(isLinearContextConfigured(undefined)).toBe(false);
    });

    it('should return false for empty API key', () => {
      const context: LinearContext = { apiKey: '' };
      expect(isLinearContextConfigured(context)).toBe(false);
    });

    it('should return false for whitespace-only API key', () => {
      const context: LinearContext = { apiKey: '   ' };
      expect(isLinearContextConfigured(context)).toBe(false);
    });
  });

  describe('validateLinearApiKey', () => {
    it('should accept lin_api_ prefixed keys', () => {
      const result = validateLinearApiKey('lin_api_abc123def456');
      expect(result.valid).toBe(true);
    });

    it('should accept long alphanumeric keys', () => {
      const result = validateLinearApiKey('a'.repeat(32));
      expect(result.valid).toBe(true);
    });

    it('should reject empty keys', () => {
      const result = validateLinearApiKey('');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('required');
    });

    it('should reject short keys', () => {
      const result = validateLinearApiKey('short');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('Invalid');
    });

    it('should trim whitespace before validation', () => {
      const result = validateLinearApiKey('  lin_api_test123  ');
      expect(result.valid).toBe(true);
    });
  });

  describe('getLinearPriorityColor', () => {
    it('should return red for urgent priority', () => {
      const color = getLinearPriorityColor('Urgent');
      expect(color).toContain('red');
    });

    it('should return orange for high priority', () => {
      const color = getLinearPriorityColor('High');
      expect(color).toContain('orange');
    });

    it('should return yellow for medium priority', () => {
      const color = getLinearPriorityColor('Medium');
      expect(color).toContain('yellow');
    });

    it('should return blue for low priority', () => {
      const color = getLinearPriorityColor('Low');
      expect(color).toContain('blue');
    });

    it('should return slate for unknown priority', () => {
      const color = getLinearPriorityColor('Unknown');
      expect(color).toContain('slate');
    });

    it('should be case-insensitive', () => {
      const color = getLinearPriorityColor('URGENT');
      expect(color).toContain('red');
    });
  });

  describe('getLinearStatusColor', () => {
    it('should return green for done status', () => {
      const color = getLinearStatusColor('Done');
      expect(color).toContain('green');
    });

    it('should return green for completed status', () => {
      const color = getLinearStatusColor('Completed');
      expect(color).toContain('green');
    });

    it('should return blue for in progress status', () => {
      const color = getLinearStatusColor('In Progress');
      expect(color).toContain('blue');
    });

    it('should return blue for in review status', () => {
      const color = getLinearStatusColor('In Review');
      expect(color).toContain('blue');
    });

    it('should return red for blocked status', () => {
      const color = getLinearStatusColor('Blocked');
      expect(color).toContain('red');
    });

    it('should return red for cancelled status', () => {
      const color = getLinearStatusColor('Cancelled');
      expect(color).toContain('red');
    });

    it('should return slate for backlog status', () => {
      const color = getLinearStatusColor('Backlog');
      expect(color).toContain('slate');
    });

    it('should return slate for todo status', () => {
      const color = getLinearStatusColor('Todo');
      expect(color).toContain('slate');
    });

    it('should return purple for unknown status', () => {
      const color = getLinearStatusColor('Custom Status');
      expect(color).toContain('purple');
    });
  });
});
