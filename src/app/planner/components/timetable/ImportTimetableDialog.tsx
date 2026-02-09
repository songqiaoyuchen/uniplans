import * as React from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";
import { alpha } from "@mui/material/styles";
import LinkIcon from "@mui/icons-material/Link";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import ContentPasteIcon from "@mui/icons-material/ContentPaste";

interface ImportTimetableDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (input: string) => void;
}

const ImportTimetableDialog: React.FC<ImportTimetableDialogProps> = ({
  open,
  onClose,
  onConfirm,
}) => {
  const [value, setValue] = React.useState("");
  const theme = useTheme();

  const handleConfirm = () => {
    if (!value.trim()) return;
    onConfirm(value.trim());
    setValue("");
  };

  const handleClose = () => {
    setValue("");
    onClose();
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setValue(text);
    } catch (err) {
      console.error("Failed to read clipboard", err);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="sm" 
      fullWidth
      slotProps={{
        paper: {
          sx: { 
            borderRadius: 3, 
            padding: 1,
            boxShadow: theme.shadows[10] 
          } 
        }}}
    >
      <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ 
            bgcolor: alpha(theme.palette.secondary.main, 0.15), 
            color: 'secondary.main', 
            p: 1.2, 
            borderRadius: 2, // Slightly squared corners look more modern/distinct
            display: 'flex',
            border: `1px solid ${alpha(theme.palette.secondary.main, 0.2)}` // Subtle border for definition
          }}>
            <CloudDownloadIcon />
          </Box>
          <Box>
            <Typography variant="h6" component="div" sx={{ fontWeight: 700, color: 'text.primary' }}>
                    Import Timetable
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ overflowY: 'visible', pt: 1 }}>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <Typography variant="body1" color="text.primary">
            Paste a valid <strong>UniPlans link</strong> or a <strong>Snapshot ID</strong> below to load a saved timetable.
          </Typography>

          <TextField
            autoFocus
            color="secondary"
            label="Link or Snapshot ID"
            placeholder="e.g., https://uniplans.net/planner..."
            fullWidth
            variant="outlined"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleConfirm();
              }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LinkIcon color="secondary" />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton 
                    onClick={handlePaste} 
                    edge="end" 
                    title="Paste from clipboard"
                    color="secondary"
                  >
                    <ContentPasteIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                '&.Mui-focused fieldset': {
                  borderColor: 'secondary.main',
                  borderWidth: 2,
                },
              },
            }}
          />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} sx={{ color: 'text.primary', fontWeight: 600 }}>
          Cancel
        </Button>
        <Button 
          variant="contained" 
          onClick={handleConfirm}
          disabled={!value.trim()}
          disableElevation
          startIcon={<CloudDownloadIcon />}
          sx={{ fontWeight: 600, px: 3, bgcolor: 'secondary.dark', '&:hover': { bgcolor: 'secondary.main' } }}
        >
          Import
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ImportTimetableDialog;