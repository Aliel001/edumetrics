import React from 'react';
import { useAuth } from '../context/AuthContext';

interface CalendarYearPickerProps {
  value?: string;
  onChange?: (year: string) => void;
}

export default function CalendarYearPicker({ value, onChange }: CalendarYearPickerProps) {
  const { academicYear, setAcademicYear } = useAuth();
  const currentYear = new Date().getFullYear();

  const currentValue = value !== undefined ? value : academicYear;
  const currentOnChange = React.useCallback((val: string) => {
    if (onChange) {
      onChange(val);
    }
    setAcademicYear(val);
  }, [onChange, setAcademicYear]);

  const options = React.useMemo(() => {
    const opts = [];
    for (let i = 0; i <= 100; i++) {
      const startYear = currentYear + i;
      const endYear = startYear + 1;
      const key = startYear.toString();
      const label = `${startYear}/${endYear}`;
      opts.push({ key, label });
    }
    return opts;
  }, [currentYear]);

  // Merge selected value into options for backward compatibility if it is older than the current year
  const finalOptions = React.useMemo(() => {
    const opts = [...options];
    const numericVal = parseInt(currentValue);
    if (!isNaN(numericVal) && numericVal < currentYear) {
      for (let yr = currentYear - 1; yr >= numericVal; yr--) {
        if (!opts.some(opt => opt.key === yr.toString())) {
          opts.unshift({
            key: yr.toString(),
            label: `${yr}/${yr + 1}`
          });
        }
      }
    }
    return opts;
  }, [options, currentValue, currentYear]);

  return (
    <div className="flex flex-col gap-1 text-left">
      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-mono">Academic Year</span>
      <select
        value={currentValue}
        onChange={(e) => currentOnChange(e.target.value)}
        className="px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 bg-slate-50 hover:bg-slate-100 outline-none cursor-pointer focus:ring-2 focus:ring-logo-500/10 focus:border-logo-400 h-[42px] transition-all shadow-sm"
      >
        {finalOptions.map((opt) => (
          <option key={opt.key} value={opt.key}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

