import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  Paper,
  Box,
  Button,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { Task } from './Task';
import { ListHeader } from './ListHeader';
import type {
  List as ListType,
  Task as TaskType,
  Label,
  CreateTaskInput,
  UpdateTaskInput,
} from '../../types/board';

type ListProps = {
  list: ListType;
  tasks: TaskType[];
  labels?: Label[];
  onUpdateTitle: (title: string) => void;
  onDelete: () => void;
  onAddTask: (input: CreateTaskInput) => void;
  onEditTask: (task: TaskType) => void;
  onUpdateTask?: (taskId: string, updates: UpdateTaskInput) => void;
};

export function List({
  list,
  tasks,
  labels = [],
  onUpdateTitle,
  onDelete,
  onAddTask,
  onEditTask,
  onUpdateTask,
}: ListProps) {
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const { setNodeRef, isOver } = useDroppable({
    id: list.id,
    data: {
      type: 'list',
      list,
    },
  });

  const activeTasks = tasks.filter((task) => !task.completedAt);
  const completedTasks = tasks.filter((task) => task.completedAt);
  const taskIds = activeTasks.map((t) => t.id);

  const handleAddTask = () => {
    const title = newTaskTitle.trim();
    if (title) {
      onAddTask({ title });
      setNewTaskTitle('');
      setIsAddingTask(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddTask();
    } else if (e.key === 'Escape') {
      setNewTaskTitle('');
      setIsAddingTask(false);
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Don't close if clicking on the Add or Cancel buttons
    if (e.relatedTarget?.closest('button')) {
      return;
    }
    setNewTaskTitle('');
    setIsAddingTask(false);
  };

  return (
    <Paper
      className={`flex flex-col w-72 shrink-0 ${
        isOver ? 'ring-2 ring-primary-500' : ''
      }`}
      sx={{
        backgroundColor: '#f4f5f7',
        borderRadius: 2,
        maxHeight: 'calc(100vh - 140px)',
      }}
    >
      <ListHeader
        title={list.title}
        taskCount={activeTasks.length}
        onUpdateTitle={onUpdateTitle}
        onDelete={onDelete}
      />

      <Box
        ref={setNodeRef}
        className="flex-1 overflow-y-auto px-2 py-2 min-h-[100px]"
        sx={{
          scrollbarWidth: 'none', // Firefox - no zero-width visible option
          scrollbarGutter: 'stable',
          '&::-webkit-scrollbar': {
            width: '0px',
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: '#c1c1c1',
            borderRadius: '3px',
          },
        }}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {activeTasks.map((task) => (
            <Task
              key={task.id}
              task={task}
              labels={labels}
              onEdit={onEditTask}
              onUpdate={onUpdateTask}
            />
          ))}
        </SortableContext>

        {activeTasks.length === 0 && (
          <Box className="text-center text-gray-400 py-4 text-sm">
            No tasks yet
          </Box>
        )}

        {completedTasks.length > 0 && (
          <Accordion
            disableGutters
            elevation={0}
            sx={{ bgcolor: 'transparent', '&:before': { display: 'none' } }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="body2" color="text.secondary">
                Completed ({completedTasks.length})
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              {completedTasks.map((task) => (
                <Task
                  key={task.id}
                  task={task}
                  labels={labels}
                  onEdit={onEditTask}
                  onUpdate={onUpdateTask}
                />
              ))}
            </AccordionDetails>
          </Accordion>
        )}
      </Box>

      <Box className="p-2 border-t border-gray-200">
        {isAddingTask ? (
          <Box>
            <TextField
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              placeholder="Enter task title..."
              size="small"
              fullWidth
              autoFocus
              multiline
              maxRows={3}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'white',
                },
              }}
            />
            <Box className="flex gap-2 mt-2">
              <Button
                variant="contained"
                size="small"
                onClick={handleAddTask}
                disabled={!newTaskTitle.trim()}
              >
                Add
              </Button>
              <Button
                size="small"
                onClick={() => {
                  setNewTaskTitle('');
                  setIsAddingTask(false);
                }}
              >
                Cancel
              </Button>
            </Box>
          </Box>
        ) : (
          <Button
            startIcon={<AddIcon />}
            onClick={() => setIsAddingTask(true)}
            fullWidth
            sx={{
              justifyContent: 'flex-start',
              color: 'text.secondary',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)',
              },
            }}
          >
            Add a task
          </Button>
        )}
      </Box>
    </Paper>
  );
}
