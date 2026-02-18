import { Chip, type ChipProps } from '@mui/material';
import { getContrastColor } from '../../utils/colorUtils';
import type { Label } from '../../types/board';

type LabelChipProps = {
  label: Label;
  size?: ChipProps['size'];
  onClick?: () => void;
  onDelete?: () => void;
};

export const LabelChip = ({
  label,
  size = 'small',
  onClick,
  onDelete,
}: LabelChipProps) => {
  const textColor = getContrastColor(label.color);

  return (
    <Chip
      size={size}
      label={
        <span className="flex items-center gap-1">
          {label.emoji && <span>{label.emoji}</span>}
          <span>{label.name}</span>
        </span>
      }
      onClick={onClick}
      onDelete={onDelete}
      sx={{
        backgroundColor: label.color,
        color: textColor,
        fontWeight: 500,
        '& .MuiChip-deleteIcon': {
          color: textColor,
          opacity: 0.7,
          '&:hover': {
            color: textColor,
            opacity: 1,
          },
        },
      }}
    />
  );
};
