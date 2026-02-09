import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { Box, Typography, Menu, MenuItem } from '@mui/material';
import { AVAIL_GRADES, Grade } from '@/types/plannerTypes';
import { moduleGradeUpdated } from '@/store/timetableSlice';

interface ModuleGradeDropdownProps {
  moduleCode: string;
  currentGrade?: Grade;
}

const ModuleGradeDropdown: React.FC<ModuleGradeDropdownProps> = ({ moduleCode, currentGrade }) => {
  const dispatch = useDispatch();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  // 1. STOP PROPAGATION HERE
  // This prevents the click from reaching the ModuleCard and toggling the sidebar
  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    event.preventDefault(); 
    setAnchorEl(event.currentTarget);
  };

  const handleClose = (event?: React.MouseEvent<HTMLLIElement>) => {
    // Optional: stop propagation on close just in case, though Portal handles most cases
    if (event) {
      event.stopPropagation();
    }
    setAnchorEl(null);
  };

  const handleSelect = (grade: Grade, event: React.MouseEvent<HTMLLIElement>) => {
    event.stopPropagation(); // Stop propagation on item selection
    dispatch(moduleGradeUpdated({ code: moduleCode, grade }));
    setAnchorEl(null); // Close directly
  };

  const displayGrade = currentGrade ?? "-";

  const renderGrade = (g: string) => {
    if (g === "-") return "-";
    // show + or - as superscript, e.g. A+ -> A<sup>+</sup>
    if (g.length === 2 && (g[1] === "+" || g[1] === "-")) {
      return (
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'baseline' }}>
          <Box component="span">{g[0]}</Box>
          <Typography
            component="sup"
            sx={{
              fontSize: '0.62em',
              lineHeight: 1,
              ml: 0.15,
              transform: 'translateY(-0.45em)',
              display: 'inline-block',
            }}
          >
            {g[1]}
          </Typography>
        </Box>
      );
    }
    return g;
  };

  return (
    <>
      <Box
        onClick={handleClick}
        sx={{
          minWidth: '36px',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '4px',
          cursor: 'pointer',
          userSelect: 'none',
          
          // 2. DYNAMIC COLORING
          // Using a semi-transparent black overlay makes the background 
          // look like a darker shade of whatever the Card color is.
          backgroundColor: 'rgba(0, 0, 0, 0.06)', 
          
          // Use a soft border that blends in
          border: '1px solid rgba(0, 0, 0, 0.1)',
          
          transition: 'all 0.2s ease',
          '&:hover': {
            // Darken slightly more on hover
            backgroundColor: 'rgba(0, 0, 0, 0.12)',
            transform: 'translateY(-1px)'
          },
          '&:active': {
            transform: 'translateY(0px)'
          }
        }}
      >
        <Typography 
          variant="caption" 
          sx={{ 
            fontWeight: 'bold', 
            // Ensure text is legible. 'inherit' usually works best if 
            // the card text color changes based on background.
            color: 'text.primary',
            opacity: displayGrade === 'IP' ? 0.7 : 1,
            lineHeight: 1,
            display: 'inline-flex',
            alignItems: 'baseline'
          }}
        >
          {renderGrade(displayGrade)}
        </Typography>
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => handleClose()}
        // Stop the menu itself from capturing dragging/clicks weirdly
        onClick={(e) => e.stopPropagation()} 
        MenuListProps={{ dense: true, sx: { minWidth: '60px' } }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        {AVAIL_GRADES.map((grade) => (
          <MenuItem 
            key={grade} 
            // Pass event to handleSelect to stop propagation
            onClick={(event) => handleSelect(grade, event)} 
            selected={grade === currentGrade}
            sx={{ justifyContent: 'center' }}
          >
            <Box sx={{ display: 'inline-flex', alignItems: 'baseline' }}>{renderGrade(grade)}</Box>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default ModuleGradeDropdown;