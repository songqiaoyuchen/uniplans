'use client';

import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import { memo, useState } from 'react';
import { ModuleData, ModuleStatus } from '@/types/plannerTypes';
import { Card, useTheme, alpha, IconButton, Box } from '@mui/material';
import { useModuleCardColors } from '../../hooks';
import CloseIcon from '@mui/icons-material/Close';

interface MiniModuleCardProps {
  module: Pick<ModuleData, 'code' | 'title' | 'status'>;
  isSelected?: boolean;
  isDragging?: boolean;
  isRelated?: boolean;
  onDelete?: (moduleCode: string) => void;
  showDelete?: boolean;
}

const MiniModuleCard: React.FC<MiniModuleCardProps> = ({
  module,
  isSelected = false,
  isDragging = false,
  isRelated = false,
  onDelete,
  showDelete = false,
}) => {
  const theme = useTheme();
  const [isHovered, setIsHovered] = useState(false);
  const status = module.status ?? ModuleStatus.Satisfied;

  const {
    backgroundColor,
    borderColor,
    selectedBorderWidth,
    selectedGlowWidth,
    selectedBorderColor,
    relatedBorderColor,
  } = useModuleCardColors(status);

  // Build shadows/borders (cheap + consistent)
  const glowBlur = Math.max(4, Number(selectedGlowWidth) || 8);
  const selectedOutline = `${selectedBorderWidth || '2px'} solid ${alpha(selectedBorderColor, 0.9)}`;
  const relatedOutline = `2px solid ${alpha(relatedBorderColor ?? borderColor, 0.6)}`;
  const baseOutline = `2px solid ${alpha(borderColor, 0.5)}`;

  const selectedShadow =
    `0 0 0 1px ${alpha(selectedBorderColor, 0.95)}, ` +
    `0 0 ${glowBlur}px ${Math.max(2, Math.round(glowBlur / 4))}px ${alpha(selectedBorderColor, 0.45)}`;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(module.code);
    }
  };

  return (
    <Box 
      sx={{ 
        position: 'relative',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Card
        sx={{
          p: 1,
          cursor: 'pointer',
          userSelect: 'none',
          backgroundColor,
          border: isSelected
            ? selectedOutline
            : isRelated
              ? relatedOutline
              : baseOutline,

          // Keep glow visible; do not animate box-shadow
          boxShadow: isSelected ? selectedShadow : 'none',

          // Only animate cheap properties
          transition: 'transform 150ms ease, opacity 150ms ease, border-color 150ms ease',

          // Hover: slight lift for non-selected; preserve selected glow
          '&:hover': isSelected ? {} : { transform: 'translateY(-1px)', opacity: 0.98 },

          color: theme.palette.text.primary,
          minWidth: 80,
          position: 'relative',

          // Note: contain property removed as it prevents overflow:visible from working
          contentVisibility: 'auto' as any,
          willChange: 'transform, opacity',
        }}
      >
        <Tooltip
          disableTouchListener={isDragging}
          disableFocusListener={isDragging}
          disableHoverListener={isDragging}
          title={`${module.code}: ${module.title}`}
          arrow
          placement="right"
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
          }}
        >
          <Typography variant="body2" fontWeight="bold" textAlign="center">
            {module.code}
          </Typography>
        </Tooltip>
      </Card>
      
      {showDelete && isHovered && onDelete && (
        <IconButton
          onClick={handleDelete}
          size="small"
          sx={{
            position: 'absolute',
            top: -5,
            right: -5,
            zIndex: 10,
            backgroundColor: 'error.main',
            color: 'error.contrastText',
            width: 16,
            height: 16,
            '&:hover': {
              backgroundColor: 'error.dark',
            },
            transition: 'all 150ms ease',
            boxShadow: 2,
          }}
        >
          <CloseIcon sx={{ fontSize: '0.7rem' }} />
        </IconButton>
      )}
    </Box>
  );
};

// Custom comparator to avoid re-render storms
export default memo(
  MiniModuleCard,
  (prev, next) =>
    prev.isSelected === next.isSelected &&
    prev.isRelated === next.isRelated &&
    prev.isDragging === next.isDragging &&
    prev.module.code === next.module.code &&
    prev.module.status === next.module.status &&
    prev.module.title === next.module.title &&
    prev.showDelete === next.showDelete &&
    prev.onDelete === next.onDelete
);