import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RequirementTooltip } from '../../components/RequirementTooltip';
import type { PRDRequirement } from '../../types';

describe('RequirementTooltip Component', () => {
  const mockRequirement: PRDRequirement = {
    id: 'REQ-001',
    title: 'User Authentication',
    description: 'Users must authenticate before accessing protected resources',
    source: 'jira',
    sourceUrl: 'https://jira.example.com/browse/REQ-001',
    gap_description: 'Missing token validation in API endpoint',
  };

  it('should render children correctly', () => {
    render(
      <RequirementTooltip requirement={mockRequirement}>
        <span data-testid="trigger">PRD/TDD</span>
      </RequirementTooltip>
    );

    expect(screen.getByTestId('trigger')).toBeInTheDocument();
    expect(screen.getByText('PRD/TDD')).toBeInTheDocument();
  });

  it('should show tooltip on mouse enter', () => {
    render(
      <RequirementTooltip requirement={mockRequirement}>
        <span data-testid="trigger">PRD/TDD</span>
      </RequirementTooltip>
    );

    const trigger = screen.getByTestId('trigger');
    fireEvent.mouseEnter(trigger.parentElement!);

    expect(screen.getByText('Requirement Gap')).toBeInTheDocument();
    expect(screen.getByText('REQ-001: User Authentication')).toBeInTheDocument();
  });

  it('should hide tooltip on mouse leave', () => {
    render(
      <RequirementTooltip requirement={mockRequirement}>
        <span data-testid="trigger">PRD/TDD</span>
      </RequirementTooltip>
    );

    const trigger = screen.getByTestId('trigger');
    fireEvent.mouseEnter(trigger.parentElement!);
    
    expect(screen.getByText('Requirement Gap')).toBeInTheDocument();

    fireEvent.mouseLeave(trigger.parentElement!);
    
    expect(screen.queryByText('Requirement Gap')).not.toBeInTheDocument();
  });

  it('should display requirement details correctly', () => {
    render(
      <RequirementTooltip requirement={mockRequirement}>
        <span>Trigger</span>
      </RequirementTooltip>
    );

    fireEvent.mouseEnter(screen.getByText('Trigger').parentElement!);

    expect(screen.getByText('REQ-001: User Authentication')).toBeInTheDocument();
    expect(screen.getByText('Users must authenticate before accessing protected resources')).toBeInTheDocument();
    expect(screen.getByText('Gap Identified')).toBeInTheDocument();
    expect(screen.getByText('Missing token validation in API endpoint')).toBeInTheDocument();
  });

  it('should render source link when sourceUrl is provided', () => {
    render(
      <RequirementTooltip requirement={mockRequirement}>
        <span>Trigger</span>
      </RequirementTooltip>
    );

    fireEvent.mouseEnter(screen.getByText('Trigger').parentElement!);

    const link = screen.getByText('View in jira');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', 'https://jira.example.com/browse/REQ-001');
    expect(link.closest('a')).toHaveAttribute('target', '_blank');
  });

  it('should not render source link when sourceUrl is not provided', () => {
    const requirementWithoutUrl: PRDRequirement = {
      ...mockRequirement,
      sourceUrl: undefined,
    };

    render(
      <RequirementTooltip requirement={requirementWithoutUrl}>
        <span>Trigger</span>
      </RequirementTooltip>
    );

    fireEvent.mouseEnter(screen.getByText('Trigger').parentElement!);

    expect(screen.queryByText(/View in/)).not.toBeInTheDocument();
  });

  it('should handle confluence source correctly', () => {
    const confluenceRequirement: PRDRequirement = {
      id: 'DOC-001',
      title: 'PRD Document',
      description: 'Product requirements',
      source: 'confluence',
      sourceUrl: 'https://confluence.example.com/wiki/page/123',
      gap_description: 'Feature not implemented',
    };

    render(
      <RequirementTooltip requirement={confluenceRequirement}>
        <span>Trigger</span>
      </RequirementTooltip>
    );

    fireEvent.mouseEnter(screen.getByText('Trigger').parentElement!);

    expect(screen.getByText('View in confluence')).toBeInTheDocument();
  });

  it('should handle manual source correctly', () => {
    const manualRequirement: PRDRequirement = {
      id: 'MANUAL-001',
      title: 'Manual Requirement',
      description: 'Manually defined requirement',
      source: 'manual',
      gap_description: 'Not yet implemented',
    };

    render(
      <RequirementTooltip requirement={manualRequirement}>
        <span>Trigger</span>
      </RequirementTooltip>
    );

    fireEvent.mouseEnter(screen.getByText('Trigger').parentElement!);

    expect(screen.getByText('MANUAL-001: Manual Requirement')).toBeInTheDocument();
    expect(screen.queryByText(/View in/)).not.toBeInTheDocument();
  });
});
