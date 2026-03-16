import { Autocomplete, TextField } from '@mui/material';
import { LabelChip } from '../common/LabelChip';
import type { Label } from '../../types/board';

type LabelFilterProps = {
  labels: Label[];
  selectedLabelIds: string[];
  onFilterChange: (ids: string[]) => void;
};

export const LabelFilter = ({
  labels,
  selectedLabelIds,
  onFilterChange,
}: LabelFilterProps) => {
  const selectedLabels = labels.filter((l) => selectedLabelIds.includes(l.id));

  return (
    <Autocomplete
      multiple
      size="small"
      options={labels}
      value={selectedLabels}
      onChange={(_, newValue) => onFilterChange(newValue.map((l) => l.id))}
      getOptionLabel={(option) =>
        `${option.emoji ? option.emoji + ' ' : ''}${option.name}`
      }
      renderTags={(value, getTagProps) =>
        value.map((label, index) => {
          const { key, ...rest } = getTagProps({ index });
          return <LabelChip key={key} label={label} size="small" {...rest} />;
        })
      }
      renderOption={(props, option) => {
        const { key, ...rest } = props;
        return (
          <li key={key} {...rest}>
            <LabelChip label={option} size="small" />
          </li>
        );
      }}
      sx={{ minWidth: 200 }}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder={selectedLabels.length === 0 ? 'Filter by label' : ''}
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: 'background.paper',
            },
          }}
        />
      )}
    />
  );
};
