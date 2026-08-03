import { Box, IconButton, Tooltip } from '@mui/material';
import { Check as CheckIcon } from '@mui/icons-material';
import { labelColors } from '../../config/defaultLabels';
import { getContrastColor } from '../../utils/colorUtils';

type ColorPickerProps = {
  value: string;
  onChange: (color: string) => void;
};

export const ColorPicker = ({ value, onChange }: ColorPickerProps) => {
  return (
    <Box className="grid grid-cols-8 gap-1">
      {labelColors.map((color) => (
        <Tooltip key={color} title={color} placement="top">
          <IconButton
            onClick={() => onChange(color)}
            sx={{
              width: 32,
              height: 32,
              backgroundColor: color,
              border: value === color ? '2px solid' : '2px solid transparent',
              borderColor: value === color ? 'text.primary' : 'transparent',
              '&:hover': {
                backgroundColor: color,
                opacity: 0.8,
              },
            }}
          >
            {value === color && (
              <CheckIcon
                sx={{
                  fontSize: 16,
                  color: getContrastColor(color),
                }}
              />
            )}
          </IconButton>
        </Tooltip>
      ))}
    </Box>
  );
};
