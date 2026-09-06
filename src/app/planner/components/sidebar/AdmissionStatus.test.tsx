import type { ChangeEvent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import TextField, { type TextFieldProps } from '@mui/material/TextField';
import AdmissionStatus from './AdmissionStatus';

jest.mock('@mui/material/TextField', () => ({
  __esModule: true,
  default: jest.fn(({ label, children }: TextFieldProps) => <div aria-label={typeof label === 'string' ? label : undefined}>{children}</div>),
}));

function control(label: string) {
  const props = jest.mocked(TextField).mock.calls.find(([props]) => props.label === label)?.[0];
  expect(props).toBeDefined();
  return props!;
}

function change(value: string): ChangeEvent<HTMLInputElement> {
  return { target: { value } } as ChangeEvent<HTMLInputElement>;
}

describe('Admission Status', () => {
  beforeEach(() => jest.mocked(TextField).mockClear());

  test('renders the renamed heading and matching school icon without explanatory copy', () => {
    const markup = renderToStaticMarkup(<AdmissionStatus onChange={jest.fn()} />);
    expect(markup).toContain('Admission Status');
    expect(markup).toContain('data-testid="SchoolIcon"');
    expect(markup).not.toContain('Your student context');
    expect(markup).not.toContain('Saved privately');
    expect(control('Admission cohort year').helperText).toBeUndefined();
  });

  test('starts with an unselected cohort dropdown and Undergraduate programme', () => {
    const markup = renderToStaticMarkup(<AdmissionStatus studentContext={null} onChange={jest.fn()} />);
    expect(control('Admission cohort year')).toMatchObject({ select: true, value: '' });
    expect(control('Programme category')).toMatchObject({ select: true, value: 'Undergraduate Degree' });
    expect(markup).toContain('Undergraduate');
    expect(markup).not.toContain('Unset');
  });

  test('stores the numeric start year and the real default programme when a cohort is selected', () => {
    const onChange = jest.fn();
    renderToStaticMarkup(<AdmissionStatus onChange={onChange} />);
    control('Admission cohort year').onChange?.(change('2024'));
    expect(onChange).toHaveBeenCalledWith({ cohortYear: 2024, programmeType: 'Undergraduate Degree' });
  });

  test('preserves an existing context and does not erase the cohort when changing programme', () => {
    const onChange = jest.fn();
    const markup = renderToStaticMarkup(<AdmissionStatus studentContext={{ cohortYear: 2017, programmeType: 'Graduate Degree Research' }} onChange={onChange} />);
    expect(control('Admission cohort year').value).toBe(2017);
    expect(control('Programme category').value).toBe('Graduate Degree Research');
    expect(markup).toContain('AY2017/18');
    control('Programme category').onChange?.(change('CPE (Certificate)'));
    expect(onChange).toHaveBeenCalledWith({ cohortYear: 2017, programmeType: 'CPE (Certificate)' });
  });
});
