import { Routes } from '@angular/router';
import { AgendaPage } from './features/agenda/agenda-page';
import { DashboardPage } from './features/dashboard/dashboard-page';
import { BoardWorkspace } from './layout/board-workspace/board-workspace';

// `boardId` binds straight to BoardStore via ActivatedRoute (see board.store.ts),
// replacing the source app's hand-rolled useBoardIdFromUrl.
export const routes: Routes = [
  { path: '', component: DashboardPage },
  { path: 'agenda', component: AgendaPage },
  { path: 'board', component: BoardWorkspace },
  { path: 'board/:boardId', component: BoardWorkspace },
];
