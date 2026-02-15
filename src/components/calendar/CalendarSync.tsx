import { Box, Button, Chip, CircularProgress, Tooltip } from '@mui/material';
import {
  Sync as SyncIcon,
  SyncDisabled as SyncDisabledIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import type { CalendarSyncState } from '../../types/calendar';

type CalendarSyncProps = {
  syncState: CalendarSyncState;
  isConnected: boolean;
  onSync: () => void;
};

const formatLastSync = (lastSyncAt: Date | undefined) => {
  if (!lastSyncAt) return 'Never synced';
  const diff = Date.now() - lastSyncAt.getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return lastSyncAt.toLocaleDateString();
};

export function CalendarSync({
  syncState,
  isConnected,
  onSync,
}: CalendarSyncProps) {
  const { isSyncing, lastSyncAt, error } = syncState;

  const lastSyncLabel = formatLastSync(lastSyncAt);

  if (!isConnected) {
    return (
      <Tooltip title="Sign in with Google to enable calendar sync">
        <Chip
          icon={<SyncDisabledIcon />}
          label="Calendar not connected"
          size="small"
          variant="outlined"
          color="default"
        />
      </Tooltip>
    );
  }

  return (
    <Box className="flex items-center gap-2">
      {error ? (
        <Tooltip title={error}>
          <Chip
            icon={<ErrorIcon />}
            label="Sync error"
            size="small"
            color="error"
            variant="outlined"
          />
        </Tooltip>
      ) : (
        <Tooltip title={`Last sync: ${lastSyncLabel}`}>
          <Chip
            icon={<CheckIcon />}
            label="Calendar synced"
            size="small"
            color="success"
            variant="outlined"
          />
        </Tooltip>
      )}

      <Button
        size="small"
        startIcon={isSyncing ? <CircularProgress size={16} /> : <SyncIcon />}
        onClick={onSync}
        disabled={isSyncing}
      >
        {isSyncing ? 'Syncing...' : 'Sync now'}
      </Button>
    </Box>
  );
}
