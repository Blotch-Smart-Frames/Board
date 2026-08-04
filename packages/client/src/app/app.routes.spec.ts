import { AgendaPage } from './features/agenda/agenda-page';
import { DashboardPage } from './features/dashboard/dashboard-page';
import { BoardWorkspace } from './layout/board-workspace/board-workspace';
import { routes } from './app.routes';

describe('app routes', () => {
  it('maps every top-level path to its expected component', () => {
    expect(routes).toEqual([
      { path: '', component: DashboardPage },
      { path: 'agenda', component: AgendaPage },
      { path: 'board', component: BoardWorkspace },
      { path: 'board/:boardId', component: BoardWorkspace },
    ]);
  });
});
