'use client';

import { Card, Typography, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useTheme } from '@mui/material/styles';
import { useDispatch } from 'react-redux';
import { moduleRemoved } from '@/store/timetableSlice';

interface ErrorModuleCardProps {
  moduleCode: string;
}

const ErrorModuleCard: React.FC<ErrorModuleCardProps> = ({ moduleCode }) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const message = `Failed to load module: ${moduleCode}`;

  const handleDelete = () => {
    dispatch(moduleRemoved({ moduleCode }));
  };

  return (
    <Card
      sx={{
        minWidth: '225px',
        height: '105px',
        userSelect: 'none',
        borderRadius: 1,
        backgroundColor: theme.palette.error.light,
        border: `2px solid ${theme.palette.error.main}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 1.5,
        gap: 2,
        cursor: 'pointer',
        transition: 'box-shadow 0.2s ease',
        '&:hover': {
          boxShadow: 6,
        },
        color: theme.palette.error.main,
      }}
    >
      <IconButton
        onClick={handleDelete}
        sx={{
          color: theme.palette.error.main,
          transition: 'transform 0.2s ease, color 0.2s ease',
          '&:hover': {
            transform: 'scale(1.2)',
            color: theme.palette.error.dark,
          },
        }}
      >
        <DeleteIcon />
      </IconButton>
      <Typography
        variant="body2"
        sx={{
          fontWeight: 600,
          lineHeight: 1.4,
          overflowWrap: 'break-word',
          maxWidth: '80%',
        }}
      >
        {message}
      </Typography>
    </Card>
  );
};

export default ErrorModuleCard;
