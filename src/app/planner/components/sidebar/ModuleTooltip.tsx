'use client';

// Presentational Layer

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import { memo } from 'react';
import { ModuleData } from '@/types/plannerTypes';
import { useTheme } from '@mui/material';
import { useModuleCardColors } from '../../hooks';

interface ModuleTooltipProps {
  module: Pick<ModuleData, "code" | "title" | "status">;
  isPlanned: boolean;
}

const ModuleTooltip: React.FC<ModuleTooltipProps> = ({ module, isPlanned }) => {
  const theme = useTheme();
  const { backgroundColor } = useModuleCardColors(module.status);

  return (
    <Box
      sx={{
        m: 0.5,
        p: 0.5,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        backgroundColor: isPlanned ? backgroundColor : theme.palette.background.paper,
        width: 'fit-content',
        cursor: isPlanned ? 'pointer' : 'grab',
        userSelect: 'none',
        '&:hover': {
          backgroundColor: isPlanned ? backgroundColor : 'action.hover',
        },
        '&:active': {
          cursor: isPlanned ? 'not-allowed' : 'grabbing',
        },
      }}
    >
      <Tooltip title={`${module.code}: ${module.title}`} arrow placement="right"
        slotProps={{
          popper: {
            modifiers: [
              {
                name: 'customStyle',
                enabled: true,
                phase: 'beforeWrite',
                fn: ({ state }) => {
                  Object.assign(state.elements.popper.style, {
                    userSelect: 'none',
                    cursor: 'default',
                  });
                },
              },
            ],
          },
        }}>
        <Typography variant="body2" fontWeight='bold'>
          {module.code}
        </Typography>
      </Tooltip>
    </Box>
  );
};

export default memo(ModuleTooltip);
