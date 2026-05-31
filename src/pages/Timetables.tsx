import React, { useEffect, useState, useRef } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { 
  Loader2, 
  Download, 
  Printer, 
  Filter,
  User,
  GraduationCap,
  Clock,
  Coffee,
  Utensils
} from 'lucide-react';
import { motion } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'react-hot-toast';

export default function Timetables() {
  const { user } = useAuth();
  const [timetable, setTimetable] = useState<any[]>([]);
  const [timeSlots, setTimeSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [weekdays, setWeekdays] = useState<any[]>([]);

  const [filterType, setFilterType] = useState<'class' | 'teacher'>(user?.role === 'teacher' ? 'teacher' : 'class');
  const [filterId, setFilterId] = useState(user?.role === 'teacher' ? user.id : '');

  const timetableRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sRes, cRes, tRes, wRes] = await Promise.all([
        api.get('/time-slots'),
        api.get('/classes'),
        api.get('/teachers'),
        api.get('/weekdays')
      ]);
      
      const safeTimeSlots = Array.isArray(sRes.data) ? sRes.data : [];
      const safeClasses = Array.isArray(cRes.data) ? cRes.data : [];
      const safeTeachers = Array.isArray(tRes.data) ? tRes.data : [];
      const safeWeekdays = Array.isArray(wRes.data) ? wRes.data : [];

      setTimeSlots(safeTimeSlots);
      setClasses(safeClasses);
      setTeachers(safeTeachers);
      setWeekdays(safeWeekdays);

      if (filterId) {
        const query = filterType === 'class' ? `classId=${filterId}` : `teacherId=${filterId}`;
        const timetableRes = await api.get(`/timetable?${query}`);
        setTimetable(Array.isArray(timetableRes.data) ? timetableRes.data : []);
      }
    } catch (error) {
      toast.error('Failed to load timetable data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterId, filterType]);

  const exportPDF = () => {
    if (!filterId) return;
    
    const doc = new jsPDF('l', 'mm', 'a4');
    const title = filterType === 'class' 
      ? `Class Timetable: ${classes.find(c => c.id === filterId)?.className}`
      : `Teacher Timetable: ${teachers.find(t => t.id === filterId)?.fullname}`;
    
    doc.setFontSize(18);
    doc.text(title, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 30);

    const safeWeekdays = Array.isArray(weekdays) ? weekdays : [];
    const safeTimeSlots = Array.isArray(timeSlots) ? timeSlots : [];
    const tableHeaders = [['Time', ...safeWeekdays.map(d => d.dayName)]];
    const tableBody = safeTimeSlots.map(slot => {
      const row = [`${slot.startTime} - ${slot.endTime}`];
      safeWeekdays.forEach(day => {
        if (slot.slotType !== 'class') {
          row.push(slot.slotType.toUpperCase());
        } else {
          const session = timetable.find(t => t.weekdayId === day.id && t.timeSlotId === slot.id);
          if (session) {
            row.push(filterType === 'class' 
              ? `${session.subject?.subjectName}\n(${session.teacher?.fullname})`
              : `${session.subject?.subjectName}\n(${session.class?.className})`
            );
          } else {
            row.push('-');
          }
        }
      });
      return row;
    });

    autoTable(doc, {
      startY: 40,
      head: tableHeaders,
      body: tableBody,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
      didParseCell: (data) => {
        if (data.section === 'body' && (data.cell.text[0] === 'BREAK' || data.cell.text[0] === 'LUNCH')) {
          data.cell.styles.fillColor = [241, 245, 249];
          data.cell.styles.textColor = [100, 116, 139];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });

    doc.save(`Timetable_${filterType}_${filterId}.pdf`);
  };

  const getSlotContent = (weekdayId: string, timeSlot: any) => {
    if (timeSlot.slotType === 'break') {
      return (
        <div className="bg-amber-50 h-full flex items-center justify-center gap-2 text-amber-600 font-bold text-[10px] uppercase tracking-widest border border-amber-100 rounded-lg">
          <Coffee size={14} />
          BREAK
        </div>
      );
    }
    if (timeSlot.slotType === 'lunch') {
      return (
        <div className="bg-rose-50 h-full flex items-center justify-center gap-2 text-rose-600 font-bold text-[10px] uppercase tracking-widest border border-rose-100 rounded-lg">
          <Utensils size={14} />
          LUNCH
        </div>
      );
    }

    // Timetable Business Rule visually applied to free slots
    const day = weekdays.find(d => d.id === weekdayId);
    if (day && day.dayName.toLowerCase() === 'wednesday' && (timeSlot.slotType || '').toLowerCase() === 'class') {
      const activeClassSlots = timeSlots.filter(s => (s.slotType || '').toLowerCase() === 'class');
      const slotIndex = activeClassSlots.findIndex(s => s.id === timeSlot.id);
      if (slotIndex !== -1 && slotIndex >= activeClassSlots.length - 3) {
        return (
          <div className="bg-emerald-50/75 h-full flex flex-col items-center justify-center text-center gap-1 border border-emerald-100/50 rounded-xl px-2">
            <span className="text-emerald-700 font-black text-[10px] uppercase tracking-wider font-sans">FREE PERIOD</span>
            <span className="text-[9px] text-emerald-600 font-semibold opacity-85 leading-none">Wednesday Reserved</span>
          </div>
        );
      }
    }

    const session = timetable.find(t => t.weekdayId === weekdayId && t.timeSlotId === timeSlot.id);
    if (!session) return null;
    
    return (
      <div className={`p-2 rounded-lg text-xs h-full flex flex-col justify-center gap-1 shadow-sm border ${
        filterType === 'teacher' ? 'bg-sky-50 text-sky-700 font-bold border-sky-100' : 'bg-logo-50 text-logo-700 font-bold border-logo-100'
      }`}>
        <div className="font-bold uppercase tracking-tight truncate leading-tight">{session.subject?.subjectName}</div>
        <div className="flex items-center gap-1 text-[10px] opacity-70">
           {filterType === 'teacher' ? (
             <>
               <GraduationCap size={10} />
               <span>{session.class?.className}</span>
             </>
           ) : (
             <>
               <User size={10} />
               <span>{session.teacher?.fullname.split(' ')[0]}</span>
             </>
           )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-8 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
             <Clock className="text-logo-600" />
             {user?.role === 'teacher' && filterId === user.id 
               ? 'My Weekly Schedule' 
               : (filterType === 'teacher' ? 'Teacher Academic Schedule' : 'Class Timetable View')}
          </h2>
          <p className="text-slate-500">
            {user?.role === 'teacher' && filterId === user.id 
              ? `Personal academic overview for ${user.fullname}` 
              : 'Weekly operational visualization for educational activities'}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={exportPDF} className="btn bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200 flex items-center gap-2">
            <Download size={18} />
            Export
          </button>
          <button onClick={() => window.print()} className="btn bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200 flex items-center gap-2">
            <Printer size={18} />
            Print
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex flex-wrap items-center gap-6 mb-8 pb-8 border-b border-slate-50">
           {user?.role === 'admin' && (
             <div className="flex p-1 bg-slate-100 rounded-xl">
                <button 
                  onClick={() => { setFilterType('class'); setFilterId(''); }}
                  className={`px-6 py-2 text-sm font-bold rounded-lg transition-all ${filterType === 'class' ? 'bg-white shadow-md text-logo-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Classes
                </button>
                <button 
                  onClick={() => { setFilterType('teacher'); setFilterId(''); }}
                  className={`px-6 py-2 text-sm font-bold rounded-lg transition-all ${filterType === 'teacher' ? 'bg-white shadow-md text-logo-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Teachers
                </button>
             </div>
           )}

           <div className="flex-1 max-w-md">
             <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Target Selection</label>
             {filterType === 'class' ? (
                <select 
                  className="input-field py-2.5 font-semibold" 
                  value={filterId} 
                  onChange={(e) => setFilterId(e.target.value)}
                >
                  <option value="">Choose Class...</option>
                  {Array.isArray(classes) && classes.map(c => <option key={c.id} value={c.id}>{c.className}</option>)}
                </select>
             ) : (
                <select 
                  className="input-field py-2.5 font-semibold" 
                  value={filterId} 
                  disabled={user?.role === 'teacher'}
                  onChange={(e) => setFilterId(e.target.value)}
                >
                  <option value="">Choose Teacher...</option>
                  {Array.isArray(teachers) && teachers.map(t => <option key={t.id} value={t.id}>{t.fullname}</option>)}
                </select>
             )}
           </div>
        </div>

        {loading ? (
          <div className="py-24 text-center">
            <Loader2 className="animate-spin mx-auto text-logo-600 w-12 h-12 mb-4" />
            <p className="text-slate-500 font-medium">Synthesizing schedule data...</p>
          </div>
        ) : !filterId ? (
          <div className="py-24 text-center border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50/50">
             <Filter className="mx-auto text-slate-200 mb-4" size={56} />
             <p className="text-slate-400 font-bold text-lg">Select a {filterType} to visualize</p>
             <p className="text-slate-300 text-sm">Real-time scheduling data will appear here</p>
          </div>
        ) : (
          <motion.div 
            ref={timetableRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="overflow-x-auto pb-4 custom-scrollbar"
          >
            <table className="w-full border-separate border-spacing-2 min-w-[900px]">
              <thead>
                <tr>
                   <th className="p-4 bg-slate-50/50 border-b border-slate-100 w-32 rounded-lg"></th>
                  {Array.isArray(weekdays) && weekdays.map(day => (
                    <th key={day.id} className="p-4 bg-slate-900 border-b-2 border-logo-500 text-white font-bold uppercase text-[11px] tracking-[0.2em] rounded-lg">
                      {day.dayName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.isArray(timeSlots) && timeSlots.map(slot => (
                  <tr key={slot.id}>
                    <td className="p-4 bg-slate-50/80 border border-slate-100 whitespace-nowrap rounded-lg shadow-sm">
                      <div className="text-xs font-black text-slate-800 font-mono tracking-tighter">{slot.startTime}</div>
                      <div className="text-[10px] text-slate-400 font-medium">{slot.endTime}</div>
                      <div className={`mt-1 text-[8px] font-bold uppercase ${slot.slotType === 'class' ? 'text-logo-500' : 'text-amber-400'}`}>
                        {slot.slotType}
                      </div>
                    </td>
                    {Array.isArray(weekdays) && weekdays.map(day => (
                      <td key={`${day.id}-${slot.id}`} className="h-28 min-w-[140px] group transition-all duration-300">
                        {getSlotContent(day.id, slot)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}
      </div>
    </div>
  );
}
