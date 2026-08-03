import { Routes } from '@angular/router';
import { BoardWorkspace } from './layout/board-workspace/board-workspace';

// `boardId` binds straight to BoardStore via ActivatedRoute (see board.store.ts),
// replacing the source app's hand-rolled useBoardIdFromUrl.
export const routes: Routes = [
  { path: '', component: BoardWorkspace },
  { path: 'board/:boardId', component: BoardWorkspace },
];
