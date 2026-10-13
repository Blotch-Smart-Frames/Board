import { Routes } from '@angular/router';
import { AgendaPage } from './features/agenda/agenda-page';
import { ConnectPage } from './features/connect/connect-page';
import { DashboardPage } from './features/dashboard/dashboard-page';
import { BoardWorkspace } from './layout/board-workspace/board-workspace';

// `boardId` binds straight to BoardStore via ActivatedRoute (see board.store.ts),
// replacing the source app's hand-rolled useBoardIdFromUrl.
export const routes: Routes = [
  { path: '', component: DashboardPage },
  { path: 'agenda', component: AgendaPage },
  { path: 'board', component: BoardWorkspace },
  { path: 'board/:boardId', component: BoardWorkspace },
  // OAuth consent screen for AI apps connecting through the MCP server.
  { path: 'connect', component: ConnectPage },
];
