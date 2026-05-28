import React from 'react';

interface CalendarYearPickerProps {
  value: string;
  onChange: (year: string) => void;
}

const YEAR_OPTIONS = [
  { key: '2023', label: '2023/24' },
  { key: '2024', label: '2024/25' },
  { key: '2025', label: '2025/26' },
  { key: '2026', label: '2026/27' },
];

export default function CalendarYearPicker({ value, onChange }: CalendarYearPickerProps) {
  return (
    <div className="flex flex-col gap-1 text-left">
      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-mono">Academic Year</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 bg-slate-50 hover:bg-slate-100 outline-none cursor-pointer focus:ring-2 focus:ring-logo-500/10 focus:border-logo-400 h-[42px] transition-all shadow-sm"
      >
        {YEAR_OPTIONS.map((opt) => (
          <option key={opt.key} value={opt.key}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
