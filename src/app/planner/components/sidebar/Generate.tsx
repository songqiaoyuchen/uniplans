import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import FlagIcon from '@mui/icons-material/Flag';
import BlockIcon from '@mui/icons-material/Block';
import Switch from '@mui/material/Switch';
import IconButton from '@mui/material/IconButton';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import FormControlLabel from '@mui/material/FormControlLabel';
import Slider from '@mui/material/Slider';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import AdmissionStatus from './AdmissionStatus';
import { getAdmissionContext } from '@/utils/planner/admissionStatus';
import { isPlainRecord } from '@/utils/prerequisites/isPlainRecord';
import { useMemo, useState, useEffect } from 'react';
import miniModuleData from '@/data/miniModuleData.json';
import { useLazyGetTimetableQuery } from '@/store/apiSlice';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';
import { useAppDispatch } from '@/store';
import { 
  targetModuleRemoved, 
  exemptedModuleRemoved, 
  specialTermsToggled, 
  maxMcsUpdated,
  preserveTimetableToggled,
  preserveSemestersUpdated,
  semestersAdapter,
  studentContextUpdated
} from '@/store/timetableSlice';
import MiniModuleCard from '../timetable/MiniModuleCard';
import { mapModuleCodesForDisplay } from '@/utils/planner/mapModuleCodesForDisplay';
import {
  MAX_EXEMPTED_MODULES,
  MAX_MCS_PER_SEMESTER,
  MAX_TARGET_MODULES,
  MCS_PER_SEMESTER_STEP,
  MIN_MCS_PER_SEMESTER,
} from '@/constants/plannerLimits';

const { selectAll: selectAllSemesters } = semestersAdapter.getSelectors();

const Generate: React.FC = () => {
  const dispatch = useAppDispatch();
  const [triggerGetTimetable, result] = useLazyGetTimetableQuery();
  const { isFetching, isSuccess } = result;
  
  type SnackbarState = {
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  };

  const [dismissedRequestId, setDismissedRequestId] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState(0);

  const targetModuleCodes = useSelector((state: RootState) => {
    const targeted = state.timetable.targetModules;
    return Array.isArray(targeted) ? targeted : [];
  });

  const exemptedModuleCodes = useSelector((state: RootState) => {
    const exempted = state.timetable.exemptedModules;
    return Array.isArray(exempted) ? exempted : [];
  });

  const { 
    useSpecialTerms, 
    maxMcsPerSemester, 
    preserveTimetable, 
    preserveSemesters,
    studentContext,
    generationRequestId
  } = useSelector((state: RootState) => state.timetable);
  const activeTimetableName = useSelector((state: RootState) => state.planner.activeTimetableName);
  const isCurrentRequest = !!generationRequestId && result.requestId === generationRequestId;
  const data = isCurrentRequest && !isFetching ? result.currentData : undefined;
  const error = isCurrentRequest ? result.error : undefined;
  const errorData = error && 'data' in error ? error.data : null;
  const generationErrorMessage = isPlainRecord(errorData) && typeof errorData.error === 'string'
    ? errorData.error : 'Error generating timetable. Please try again.';
  const { cohortYear, programmeType } = getAdmissionContext(studentContext);
  useEffect(() => {
    if (studentContext?.programmeType == null) {
      dispatch(studentContextUpdated({ cohortYear, programmeType }));
    }
  }, [dispatch, cohortYear, programmeType, studentContext?.programmeType]);

  const allSemesters = useSelector((state: RootState) => selectAllSemesters(state.timetable.semesters));
  const maxSemesterId = useMemo(() => {
    if (!Array.isArray(allSemesters) || allSemesters.length === 0) return -1;
    return Math.max(...allSemesters.map(s => (s && typeof s.id === 'number') ? s.id : -1));
  }, [allSemesters]);

  // If maxSemesterId is -1 (no semesters), totalSemesters will be 0.
  const totalSemesters = maxSemesterId >= 0 ? Math.ceil((maxSemesterId + 1) / 2) : 0;

  // Create module objects from codes
  const targetModules = useMemo(() => {
    return mapModuleCodesForDisplay(targetModuleCodes, miniModuleData);
  }, [targetModuleCodes]);

  const exemptedModules = useMemo(() => {
    return mapModuleCodesForDisplay(exemptedModuleCodes, miniModuleData);
  }, [exemptedModuleCodes]);

  const handleDeleteTarget = (moduleCode: string) => {
    dispatch(targetModuleRemoved(moduleCode));
  };

  const handleDeleteExempted = (moduleCode: string) => {
    dispatch(exemptedModuleRemoved(moduleCode));
  };

  // Handle generation result feedback
  const snackbar: SnackbarState = (() => {
    const closed: SnackbarState = { open: false, message: '', severity: 'info' };
    if (isFetching || requestKey === 0) {
      return closed; // Don't show result while still fetching or before first request
    }
    if (isSuccess && data) {
      if (!data.isValid) {
        return { open: true, message: 'Generation error: the proposed timetable is invalid. Review it before using.', severity: 'warning' };
      }
      return data.timetable.semesters.length === 0
        ? { open: true, message: 'No valid timetable could be generated.', severity: 'warning' }
        : { open: true, message: 'Successfully generated timetable.', severity: 'success' };
    }
    return error ? { open: true, message: generationErrorMessage, severity: 'error' } : closed;
  })();

  const handleGenerate = () => {
    // Close any existing snackbar and increment request key
    setDismissedRequestId(generationRequestId);
    setRequestKey(prev => prev + 1);
    
    const preservedData: Record<number, string[]> = {};
    
    if (preserveTimetable && preserveSemesters > 0) {
      const sortedSemesters = [...allSemesters].sort((a, b) => a.id - b.id);
      const semestersToPreserve = sortedSemesters.filter(s => s.id < preserveSemesters * 2);
       
      semestersToPreserve.forEach(s => {
        preservedData[s.id] = s.moduleCodes;
      });
    }

    // Trigger the timetable generation
    triggerGetTimetable({
      requiredModuleCodes: targetModuleCodes,
      exemptedModuleCodes: exemptedModuleCodes,
      useSpecialTerms: useSpecialTerms,
      maxMcsPerSemester: maxMcsPerSemester,
      preserveTimetable: preserveTimetable,
      preservedData: preservedData,
      studentContext: { cohortYear, programmeType },
      clientTimetableName: activeTimetableName
    });
  };

  const handleSpecialTermsChange = () => {
    dispatch(specialTermsToggled());
  };

  const handlePreserveTimetableChange = () => {
    dispatch(preserveTimetableToggled());
  };

  const handlePreserveSemestersChange = (event: Event, newValue: number | number[]) => {
    dispatch(preserveSemestersUpdated(newValue as number));
  };

  const handleIncrementMcs = () => {
    if (maxMcsPerSemester < MAX_MCS_PER_SEMESTER) {
      dispatch(maxMcsUpdated(maxMcsPerSemester + MCS_PER_SEMESTER_STEP));
    }
  };

  const handleDecrementMcs = () => {
    if (maxMcsPerSemester > MIN_MCS_PER_SEMESTER) {
      dispatch(maxMcsUpdated(maxMcsPerSemester - MCS_PER_SEMESTER_STEP));
    }
  };

  const isFormValid = targetModuleCodes.length > 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* Header */}
      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
          Generate Your Timetable
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          Review your targeted and exempted modules before generating your timetable
        </Typography>
      </Box>

      <AdmissionStatus
        studentContext={{ cohortYear, programmeType }}
        onChange={context => dispatch(studentContextUpdated(context))}
      />

      {/* Target Modules Section */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <FlagIcon sx={{ fontSize: '1.2rem', color: 'primary.main' }} />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Target Modules
          </Typography>
          <Typography variant="caption" color="text.secondary">
            ({targetModules.length}/{MAX_TARGET_MODULES})
          </Typography>
        </Box>
        
        {targetModules.length > 0 ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {targetModules.map((module) => (
              <MiniModuleCard
                key={module.code}
                module={module}
                showDelete={true}
                onDelete={handleDeleteTarget}
              />
            ))}
          </Box>
        ) : (
          <Box 
            sx={{ 
              p: 2, 
              border: '1px dashed', 
              borderColor: 'divider', 
              borderRadius: 1,
              bgcolor: 'background.default',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1
            }}
          >
            <InfoOutlinedIcon color="action" sx={{ fontSize: 20 }} />
            <Typography variant="caption" color="text.secondary" align="center">
              No target modules selected. Search for modules to add them here.
            </Typography>
          </Box>
        )}
      </Box>

      {/* Exempted Modules Section */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <BlockIcon sx={{ fontSize: '1.2rem', color: 'error.main' }} />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Exempted Modules
          </Typography>
          <Typography variant="caption" color="text.secondary">
            ({exemptedModules.length}/{MAX_EXEMPTED_MODULES})
          </Typography>
        </Box>

        {exemptedModules.length > 0 ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {exemptedModules.map((module) => (
              <MiniModuleCard
                key={module.code}
                module={module}
                showDelete={true}
                onDelete={handleDeleteExempted}
              />
            ))}
          </Box>
        ) : (
          <Box 
            sx={{ 
              p: 2, 
              border: '1px dashed', 
              borderColor: 'divider', 
              borderRadius: 1,
              bgcolor: 'background.default',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1
            }}
          >
            <InfoOutlinedIcon color="action" sx={{ fontSize: 20 }} />
            <Typography variant="caption" color="text.secondary" align="center">
              No exempted modules. Search for modules to exempt them.
            </Typography>
          </Box>
        )}
      </Box>

      <Divider />

      {/* Max MCs Stepper */}
      <Box>
        <Typography variant="body2" gutterBottom sx={{ fontWeight: 600, pb: 1 }}>
          Max units per semester
        </Typography>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          p: 0.5
        }}>
          <IconButton 
            size="small" 
            onClick={handleDecrementMcs}
            disabled={maxMcsPerSemester <= MIN_MCS_PER_SEMESTER}
            color="primary"
          >
            <RemoveIcon fontSize="small" />
          </IconButton>
          
          <Typography variant="body1" sx={{ fontWeight: 500, minWidth: '3ch', textAlign: 'center' }}>
            {maxMcsPerSemester}
          </Typography>
          
          <IconButton 
            size="small" 
            onClick={handleIncrementMcs}
            disabled={maxMcsPerSemester >= MAX_MCS_PER_SEMESTER}
            color="primary"
          >
            <AddIcon fontSize="small" />
          </IconButton>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', textAlign: 'center' }}>
          Recommended: 20-24 Units
        </Typography>
      </Box>
      
      {/* Special Terms Toggle */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <FormControlLabel
          sx={{ ml: 0 }}
          control={
            <Switch
              checked={useSpecialTerms}
              onChange={handleSpecialTermsChange}
              name="specialTerms"
              color="primary"
              size="small"
            />
          }
          label={
            <Typography variant="body2">Include Special Terms</Typography>
          }
        />

        {/* Preserve Timetable Toggle */}
        <Box>
          <FormControlLabel
            sx={{ ml: 0 }}
            control={
              <Switch
                checked={preserveTimetable}
                onChange={handlePreserveTimetableChange}
                name="preserveTimetable"
                color="primary"
                size="small"
              />
            }
            label={
              <Typography variant="body2">Preserve Current Timetable</Typography>
            }
          />
          
          {preserveTimetable && (
            <Box sx={{ px: 1, mt: 1 }}>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Preserve first {preserveSemesters} semesters
              </Typography>
              <Slider
                value={preserveSemesters}
                onChange={handlePreserveSemestersChange}
                step={1}
                marks
                min={0}
                max={totalSemesters > 0 ? totalSemesters : 8}
                valueLabelDisplay="auto"
                size="small"
                sx={{ mt: 1 }}
              />
            </Box>
          )}
        </Box>

        {/* Snackbar for generation feedback */}
        <Snackbar
          open={snackbar.open && isCurrentRequest && dismissedRequestId !== generationRequestId}
          autoHideDuration={data && !data.isValid ? 6000 : 2000}
          onClose={() => setDismissedRequestId(generationRequestId)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            onClose={() => setDismissedRequestId(generationRequestId)}
            severity={snackbar.severity}
            variant="filled"
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>

      {/* Generate Button */}
      <Box sx={{ mt: 'auto', pb: 2 }}>
        <Button
          variant="contained"
          fullWidth
          size="large"
          onClick={handleGenerate}
          disabled={!isFormValid || (isCurrentRequest && isFetching)}
          sx={{ 
            py: 1.5,
            fontWeight: 600,
            textTransform: 'none',
            boxShadow: 2
          }}
        >
          {isCurrentRequest && isFetching ? 'Generating...' : 'Generate Timetable'}
        </Button>
        
        {data && !data.isValid ? (
          <Alert severity="warning" variant="outlined" sx={{ mt: 1 }}>
            Generation error: this proposed timetable failed validation and may
            violate prerequisites or scheduling constraints.
          </Alert>
        ) : null}

        {data?.validation.errors.map((message, index) => (
          <Alert key={`error-${index}`} severity="error" sx={{ mt: 1 }}>{message}</Alert>
        ))}
        {data?.validation.warnings.map((message, index) => (
          <Alert key={`warning-${index}`} severity="warning" sx={{ mt: 1 }}>{message}</Alert>
        ))}
        {error ? (
          <Typography color="error" variant="caption" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
            {generationErrorMessage}
          </Typography>
        ) : null}
      </Box>
    </Box>
  );
};

export default Generate;

