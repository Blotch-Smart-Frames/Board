# React Guidelines

## Core Rules

- **No `useEffect`** — use React Query, event handlers, or derived state instead
- **Small components** — split when >50 lines or >2 responsibilities
- **Tests** — React Testing Library, test behavior not implementation

## Patterns

```tsx
// ✅ Prefer: derived state
const filtered = items.filter((i) => i.active);

// ✅ Prefer: React Query for data
const { data } = useQuery({ queryKey: ['items'], queryFn: fetchItems });

// ✅ Prefer: event handlers for side effects
const handleSubmit = async () => {
  await save();
  refetch();
};

// ❌ Avoid: useEffect for data fetching or derived state
```

## Testing

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

test('submits form', async () => {
  render(<Form />);
  await userEvent.click(screen.getByRole('button', { name: /submit/i }));
  expect(screen.getByText(/success/i)).toBeInTheDocument();
});
```

## Structure

- Components: single responsibility, props interface at top
- Hooks: extract reusable logic, return minimal API
- Split when: multiple concerns, deep nesting, or hard to test
