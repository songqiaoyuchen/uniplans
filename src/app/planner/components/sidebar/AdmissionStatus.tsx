import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import SchoolIcon from '@mui/icons-material/School';
import { PROGRAMME_TYPES, type StudentContext } from '@/types/prerequisiteTypes';
import { DEFAULT_PROGRAMME_TYPE, getAdmissionCohortOptions, getAdmissionContext } from '@/utils/planner/admissionStatus';

type AdmissionStatusProps = {
  studentContext?: StudentContext | null;
  onChange: (context: StudentContext) => void;
};

export default function AdmissionStatus({ studentContext, onChange }: AdmissionStatusProps) {
  const { cohortYear, programmeType } = getAdmissionContext(studentContext);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SchoolIcon sx={{ fontSize: '1.2rem', color: 'primary.main' }} />
        <Typography variant="body2" sx={{ fontWeight: 600 }}>Admission Status</Typography>
      </Box>
      <TextField
        select
        label="Admission cohort year"
        size="small"
        value={cohortYear ?? ''}
        onChange={event => onChange({ cohortYear: event.target.value === '' ? null : Number(event.target.value), programmeType })}
      >
        <MenuItem value="" disabled>Admission cohort year</MenuItem>
        {getAdmissionCohortOptions(cohortYear).map(({ value, label }) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
      </TextField>
      <TextField
        select
        label="Programme category"
        size="small"
        value={programmeType}
        onChange={event => onChange({ cohortYear, programmeType: event.target.value })}
      >
        {PROGRAMME_TYPES.map(programme => (
          <MenuItem key={programme} value={programme}>
            {programme === DEFAULT_PROGRAMME_TYPE ? 'Undergraduate' : programme}
          </MenuItem>
        ))}
      </TextField>
    </Box>
  );
}
