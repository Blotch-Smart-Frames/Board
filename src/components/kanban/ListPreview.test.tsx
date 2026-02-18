import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ListPreview } from './ListPreview';
import type { List } from '../../types/board';

const createMockList = (overrides: Partial<List> = {}): List =>
  ({
    id: 'list-1',
    title: 'To Do',
    order: 'a0',
    ...overrides,
  }) as List;

describe('ListPreview', () => {
  it('renders list title', () => {
    render(<ListPreview list={createMockList({ title: 'In Progress' })} taskCount={3} />);

    expect(
      screen.getByRole('heading', { name: 'In Progress' }),
    ).toBeInTheDocument();
  });

  it('shows task count badge', () => {
    render(<ListPreview list={createMockList()} taskCount={5} />);

    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('shows singular task text for count of 1', () => {
    render(<ListPreview list={createMockList()} taskCount={1} />);

    expect(screen.getByText('1 task')).toBeInTheDocument();
  });

  it('shows plural tasks text for count > 1', () => {
    render(<ListPreview list={createMockList()} taskCount={3} />);

    expect(screen.getByText('3 tasks')).toBeInTheDocument();
  });

  it('shows 0 tasks for empty list', () => {
    render(<ListPreview list={createMockList()} taskCount={0} />);

    expect(screen.getByText('0 tasks')).toBeInTheDocument();
  });
});
