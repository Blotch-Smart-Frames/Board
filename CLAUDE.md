# CLAUDE.md

## Stack

React 19, TypeScript, Vite, React Query, MUI, Firebase, React Testing Library

## Rules

1. **No useEffect** — React Query for data, handlers for effects, derived state for transforms
2. **Small components** — <50 lines, single responsibility, split early
3. **Tests** — RTL, query by role/text, `userEvent` for interactions, no implementation details

## Quick Ref

```tsx
// Data: useQuery/useMutation
// State: useState for UI, Zustand for global
// Events: handlers, not effects
// Split: Container/Presenter, compound components
```

## Test Template

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

test('describes behavior', async () => {
  render(<Component />);
  await userEvent.click(screen.getByRole('button'));
  expect(screen.getByText(/expected/i)).toBeInTheDocument();
});
```
