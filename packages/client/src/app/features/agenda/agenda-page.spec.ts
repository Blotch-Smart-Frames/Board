import { render, screen } from '@testing-library/angular';
import { AgendaPage } from './agenda-page';

describe('AgendaPage', () => {
  it('renders the placeholder heading and description', async () => {
    await render(AgendaPage);

    expect(screen.getByRole('heading', { level: 1, name: /agenda/i })).toBeInTheDocument();
    expect(screen.getByText(/upcoming tasks and events/i)).toBeInTheDocument();
  });
});
