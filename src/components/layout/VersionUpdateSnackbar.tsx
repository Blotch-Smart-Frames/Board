import { Alert, Button, Snackbar } from '@mui/material';

type VersionUpdateSnackbarProps = {
  open: boolean;
  onRefresh: () => void;
};

export const VersionUpdateSnackbar = ({
  open,
  onRefresh,
}: VersionUpdateSnackbarProps) => (
  <Snackbar open={open} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
    <Alert
      severity="info"
      variant="filled"
      action={
        <Button color="inherit" size="small" onClick={onRefresh}>
          Refresh
        </Button>
      }
    >
      A new version is available.
    </Alert>
  </Snackbar>
);
