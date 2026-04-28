import MDEditor from '@uiw/react-md-editor';
import { Box } from '@mui/material';

type MarkdownRendererProps = {
  children: string;
};

export const MarkdownRenderer = ({ children }: MarkdownRendererProps) => (
  <Box
    data-color-mode="light"
    sx={{
      '& .wmde-markdown': {
        background: 'transparent',
        fontSize: '0.875rem',
        fontFamily: 'inherit',
      },
    }}
  >
    <MDEditor.Markdown source={children} />
  </Box>
);
