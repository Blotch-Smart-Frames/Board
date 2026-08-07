import type { Timestamp } from 'firebase/firestore';
import { render, screen } from '@testing-library/angular';
import { LabelChip } from './label-chip';
import type { Label } from '../../types/board';

function fakeLabel(overrides: Partial<Label> = {}): Label {
  return {
    id: 'l1',
    name: 'Urgent',
    color: '#EF4444',
    order: 'a0',
    createdAt: {} as Timestamp,
    updatedAt: {} as Timestamp,
    ...overrides,
  };
}

describe('LabelChip', () => {
  it('renders the label name and applies its color', async () => {
    await render(LabelChip, { inputs: { label: fakeLabel() } });

    const chip = screen
      .getByText('Urgent')
      .closest('[hlmBadge], [data-slot="badge"]') as HTMLElement;
    expect(screen.getByText('Urgent')).toBeInTheDocument();
    expect(chip.style.backgroundColor).toBeTruthy();
  });

  it('renders an emoji when present', async () => {
    await render(LabelChip, { inputs: { label: fakeLabel({ emoji: '🔥' }) } });

    expect(screen.getByText('🔥')).toBeInTheDocument();
  });

  it('uses white text on a dark background for contrast', async () => {
    await render(LabelChip, { inputs: { label: fakeLabel({ color: '#000000' }) } });

    const chip = screen.getByText('Urgent').closest('[data-slot="badge"]') as HTMLElement;
    expect(chip.style.color).toBe('white');
  });
});
