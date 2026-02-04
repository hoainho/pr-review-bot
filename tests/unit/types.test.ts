import { describe, it, expect } from 'vitest';
import { 
  Severity, 
  BugType, 
  ApprovalStatus,
  type PRIssue,
  type PRDRequirement,
} from '../../types';

describe('Types', () => {
  describe('Severity Enum', () => {
    it('should have all required severity levels', () => {
      expect(Severity.HIGH).toBe('HIGH');
      expect(Severity.MEDIUM).toBe('MEDIUM');
      expect(Severity.LOW).toBe('LOW');
      expect(Severity.CRITICAL).toBe('CRITICAL');
    });
  });

  describe('BugType Enum', () => {
    it('should have all required bug types', () => {
      expect(BugType.RACE_CONDITION).toBe('RACE_CONDITION');
      expect(BugType.STATE_MANAGEMENT).toBe('STATE_MANAGEMENT');
      expect(BugType.MEMORY_LEAK).toBe('MEMORY_LEAK');
      expect(BugType.SECURITY).toBe('SECURITY');
      expect(BugType.CRASH).toBe('CRASH');
      expect(BugType.CORRUPTION).toBe('CORRUPTION');
      expect(BugType.PERFORMANCE).toBe('PERFORMANCE');
      expect(BugType.RESOURCE_LEAK).toBe('RESOURCE_LEAK');
      expect(BugType.MERGE_CONFLICT).toBe('MERGE_CONFLICT');
      expect(BugType.CODE_DUPLICATION).toBe('CODE_DUPLICATION');
      expect(BugType.BREAKING_CHANGE).toBe('BREAKING_CHANGE');
      expect(BugType.DEPENDENCY_ISSUE).toBe('DEPENDENCY_ISSUE');
      expect(BugType.JS_SYNTAX_OPTIMIZATION).toBe('JS_SYNTAX_OPTIMIZATION');
    });
  });

  describe('ApprovalStatus Enum', () => {
    it('should have all required approval statuses', () => {
      expect(ApprovalStatus.PENDING).toBe('pending');
      expect(ApprovalStatus.APPROVED).toBe('approved');
      expect(ApprovalStatus.REJECTED).toBe('rejected');
    });
  });

  describe('PRIssue Interface', () => {
    it('should allow creating a valid PRIssue object', () => {
      const issue: PRIssue = {
        id: 'issue-123',
        bug_description: 'Test bug description',
        severity: Severity.HIGH,
        bug_type: BugType.SECURITY,
        file_name: 'src/test.ts',
        line_numbers: '10-15',
        snippet: 'const x = vulnerable(input);',
        suggested_fix: 'Use sanitized input',
        suggested_code: 'const x = sanitize(vulnerable(input));',
        approval_status: ApprovalStatus.PENDING,
        rejection_reason: '',
        prd_related: false,
      };

      expect(issue.id).toBe('issue-123');
      expect(issue.severity).toBe(Severity.HIGH);
      expect(issue.bug_type).toBe(BugType.SECURITY);
      expect(issue.approval_status).toBe(ApprovalStatus.PENDING);
    });

    it('should allow PRIssue with PRD requirement', () => {
      const prdRequirement: PRDRequirement = {
        id: 'REQ-001',
        title: 'User Authentication',
        description: 'Users must be authenticated before accessing',
        source: 'jira',
        sourceUrl: 'https://jira.example.com/browse/REQ-001',
        gap_description: 'Missing authentication check',
      };

      const issue: PRIssue = {
        bug_description: 'Missing auth check',
        severity: Severity.HIGH,
        bug_type: BugType.SECURITY,
        file_name: 'src/api.ts',
        line_numbers: '25',
        snippet: 'return data;',
        suggested_fix: 'Add authentication',
        suggested_code: 'if (!auth) throw new Error();',
        prd_related: true,
        prd_requirement: prdRequirement,
      };

      expect(issue.prd_related).toBe(true);
      expect(issue.prd_requirement?.id).toBe('REQ-001');
      expect(issue.prd_requirement?.source).toBe('jira');
    });

    it('should allow optional fields to be undefined', () => {
      const issue: PRIssue = {
        bug_description: 'Test',
        severity: Severity.LOW,
        bug_type: BugType.PERFORMANCE,
        file_name: 'test.ts',
        line_numbers: '1',
        snippet: '',
        suggested_fix: '',
        suggested_code: '',
      };

      expect(issue.id).toBeUndefined();
      expect(issue.approval_status).toBeUndefined();
      expect(issue.rejection_reason).toBeUndefined();
      expect(issue.prd_related).toBeUndefined();
      expect(issue.prd_requirement).toBeUndefined();
    });
  });

  describe('PRDRequirement Interface', () => {
    it('should allow creating valid PRDRequirement from Jira', () => {
      const req: PRDRequirement = {
        id: 'PROJ-123',
        title: 'Feature Title',
        description: 'Feature description',
        source: 'jira',
        sourceUrl: 'https://jira.example.com/browse/PROJ-123',
        gap_description: 'Implementation incomplete',
      };

      expect(req.source).toBe('jira');
      expect(req.sourceUrl).toContain('jira');
    });

    it('should allow creating valid PRDRequirement from Confluence', () => {
      const req: PRDRequirement = {
        id: 'DOC-001',
        title: 'PRD Document',
        description: 'Requirement from PRD',
        source: 'confluence',
        sourceUrl: 'https://confluence.example.com/wiki/page/123',
        gap_description: 'Missing feature',
      };

      expect(req.source).toBe('confluence');
    });

    it('should allow manual source without URL', () => {
      const req: PRDRequirement = {
        id: 'MANUAL-001',
        title: 'Manual Requirement',
        description: 'Manually added requirement',
        source: 'manual',
        gap_description: 'Not implemented',
      };

      expect(req.source).toBe('manual');
      expect(req.sourceUrl).toBeUndefined();
    });
  });
});
