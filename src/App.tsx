import { useState } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, Drawer, useMediaQuery } from '@mui/material';
import { theme } from './config/theme';
import { AuthGuard } from './components/auth/AuthGuard';
import { AppBar } from './components/layout/AppBar';
import { BoardList } from './components/layout/BoardList';
import { Board } from './components/kanban/Board';
import { ShareDialog } from './components/collaboration/ShareDialog';
import { useUserBoardsQuery } from './hooks/useUserBoardsQuery';
import { useAuthQuery } from './hooks/useAuthQuery';
import { useCollaboratorsQuery } from './hooks/useCollaboratorsQuery';
import { deleteBoard, updateBoard, shareBoard } from './services/boardService';
import { getUserByEmail } from './services/userService';

const DRAWER_WIDTH = 280;

type ViewMode = 'kanban' | 'timeline';

export const App = () => {
  const { user } = useAuthQuery();
  const { boards, isLoading, createBoard } = useUserBoardsQuery();
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const selectedBoard = boards.find((b) => b.id === selectedBoardId);

  const handleCreateBoard = async (title: string) => {
    const board = await createBoard({ title });
    setSelectedBoardId(board.id);
  };

  const handleDeleteBoard = async (boardId: string) => {
    await deleteBoard(boardId);
    if (selectedBoardId === boardId) {
      setSelectedBoardId(null);
    }
  };

  const handleRenameBoard = async (boardId: string, title: string) => {
    await updateBoard(boardId, { title });
  };

  const handleShareBoard = async (email: string) => {
    if (!selectedBoardId) return;
    const targetUser = await getUserByEmail(email);
    if (!targetUser) {
      throw new Error(`No user found with email: ${email}`);
    }
    await shareBoard(selectedBoardId, targetUser.id);
  };

  const handleRemoveCollaborator = async (userId: string) => {
    // In a real app, implement remove collaborator logic
    console.log('Remove collaborator:', userId);
  };

  const { collaborators } = useCollaboratorsQuery(selectedBoard, user);

  const drawerContent = (
    <BoardList
      boards={boards}
      selectedBoardId={selectedBoardId}
      isLoading={isLoading}
      onSelectBoard={setSelectedBoardId}
      onCreateBoard={handleCreateBoard}
      onDeleteBoard={handleDeleteBoard}
      onRenameBoard={handleRenameBoard}
    />
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthGuard>
        <Box className="flex h-screen flex-col">
          <AppBar
            title={selectedBoard?.title || 'Board by Blotch'}
            onMenuClick={() => setDrawerOpen(!drawerOpen)}
            onShare={() => setShareDialogOpen(true)}
            showShare={!!selectedBoard}
            viewMode={selectedBoardId ? viewMode : undefined}
            onViewModeChange={selectedBoardId ? setViewMode : undefined}
          />

          <Box className="flex flex-1 overflow-hidden">
            {isMobile ? (
              <Drawer
                variant="temporary"
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                sx={{
                  '& .MuiDrawer-paper': {
                    width: DRAWER_WIDTH,
                    boxSizing: 'border-box',
                  },
                }}
              >
                {drawerContent}
              </Drawer>
            ) : (
              <Drawer
                variant="persistent"
                open={drawerOpen}
                sx={{
                  width: drawerOpen ? DRAWER_WIDTH : 0,
                  flexShrink: 0,
                  '& .MuiDrawer-paper': {
                    width: DRAWER_WIDTH,
                    boxSizing: 'border-box',
                    position: 'relative',
                  },
                }}
              >
                {drawerContent}
              </Drawer>
            )}

            <Box
              component="main"
              className="flex-1 overflow-hidden"
              sx={{ bgcolor: 'background.default' }}
            >
              {selectedBoardId ? (
                <Board
                  boardId={selectedBoardId}
                  viewMode={viewMode}
                  collaborators={collaborators}
                />
              ) : (
                <Box
                  className="flex h-full items-center justify-center"
                  sx={{ color: 'text.secondary' }}
                >
                  Select a board or create a new one to get started
                </Box>
              )}
            </Box>
          </Box>
        </Box>

        {selectedBoard && (
          <ShareDialog
            open={shareDialogOpen}
            boardTitle={selectedBoard.title}
            collaborators={collaborators}
            onClose={() => setShareDialogOpen(false)}
            onInvite={handleShareBoard}
            onRemove={handleRemoveCollaborator}
          />
        )}
      </AuthGuard>
    </ThemeProvider>
  );
};
