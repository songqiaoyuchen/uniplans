import { getAdmissionCohortOptions, getAdmissionContext } from './admissionStatus';

describe('admission status controls', () => {
  test('offers academic years from 2020 through the next intake, newest first', () => {
    const options = getAdmissionCohortOptions(null, 2026);
    expect(options).toHaveLength(8);
    expect(options[0]).toEqual({ value: 2027, label: 'AY2027/28' });
    expect(options.at(-1)).toEqual({ value: 2020, label: 'AY2020/21' });
    expect(options).toContainEqual({ value: 2024, label: 'AY2024/25' });
  });

  test('keeps older and future saved cohorts selectable without duplicates', () => {
    expect(getAdmissionCohortOptions(2017, 2026).at(-1)).toEqual({ value: 2017, label: 'AY2017/18' });
    expect(getAdmissionCohortOptions(2030, 2026)[0]).toEqual({ value: 2030, label: 'AY2030/31' });
    expect(getAdmissionCohortOptions(2024, 2026)).toHaveLength(8);
  });

  test('defaults only the programme, leaving the cohort unselected', () => {
    expect(getAdmissionContext(null)).toEqual({ cohortYear: null, programmeType: 'Undergraduate Degree' });
    expect(getAdmissionContext({ cohortYear: 2024, programmeType: null })).toEqual({ cohortYear: 2024, programmeType: 'Undergraduate Degree' });
  });

  test('preserves an existing programme selection', () => {
    const context = { cohortYear: 2023, programmeType: 'Graduate Degree Coursework' };
    expect(getAdmissionContext(context)).toEqual(context);
    expect(context).toEqual({ cohortYear: 2023, programmeType: 'Graduate Degree Coursework' });
  });
});
