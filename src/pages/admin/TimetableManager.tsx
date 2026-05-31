import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { 
  Plus, 
  Trash2, 
  Edit2,
  Loader2, 
  Calendar, 
  Sparkles,
  Link2,
  AlertCircle,
  RefreshCw,
  Clock,
  Layers,
  Download,
  Users,
  Settings
} from 'lucide-react';
import { motion } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function TimetableManager() {
  const { academicYear } = useAuth();
  const navigate = useNavigate();
  const [timetable, setTimetable] = useState<any[]>([]);
  const [timeSlots, setTimeSlots] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [weekdays, setWeekdays] = useState<any[]>([]);
  const [allEntries, setAllEntries] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [viewType, setViewType] = useState<'class' | 'teacher'>('class');
  const [formData, setFormData] = useState({ 
    classId: '', 
    subjectId: '', 
    teacherId: '', 
    timeSlotId: '', 
    weekdayId: '' 
  });

  const [stats, setStats] = useState({ 
    totalAssignments: 0, 
    fulfilledPeriods: 0, 
    pendingPeriods: 0,
    hasWeekdays: false,
    hasClassSlots: false,
    hasClasses: false
  });

  const fetchMetaData = async () => {
    try {
      const [sRes, cRes, aRes, wRes, tRes] = await Promise.all([
        api.get('/time-slots'),
        api.get('/classes'),
        api.get('/assignments'),
        api.get('/weekdays'),
        api.get('/timetable')
      ]);
      
      const safeTimeSlots = Array.isArray(sRes.data) ? sRes.data : [];
      const safeClasses = Array.isArray(cRes.data) ? cRes.data : [];
      const safeAssignments = Array.isArray(aRes.data) ? aRes.data : [];
      const safeWeekdays = Array.isArray(wRes.data) ? wRes.data : [];
      const safeTimetable = Array.isArray(tRes.data) ? tRes.data : [];

      setTimeSlots(safeTimeSlots);
      setClasses(safeClasses);
      setAssignments(safeAssignments);
      setWeekdays(safeWeekdays);
      setAllEntries(safeTimetable);
      
      const total = safeAssignments.reduce((acc: number, curr: any) => acc + (curr.periodsPerWeek || 0), 0);
      const fulfilled = safeTimetable.length;
      
      setStats({
        totalAssignments: safeAssignments.length,
        fulfilledPeriods: fulfilled,
        pendingPeriods: Math.max(0, total - fulfilled),
        hasWeekdays: safeWeekdays.length > 0,
        hasClassSlots: safeTimeSlots.some((s: any) => (s.slotType || '').toLowerCase() === 'class'),
        hasClasses: safeClasses.length > 0
      });
      
      if (safeWeekdays.length > 0) {
        setFormData(prev => ({ ...prev, weekdayId: safeWeekdays[0].id }));
      }

      if (!selectedClass && safeClasses.length > 0) {
        setSelectedClass(safeClasses[0].id);
      }
    } catch (error) {
      console.error('Metadata fetch error:', error);
      toast.error('Failed to connect to database. Please check your configuration.');
    } finally {
      setLoading(false);
    }
  };

  const checkDiagnostics = async () => {
    try {
      const res = await api.get('/timetable-diagnostics');
      alert(`System Readiness Report:\n
- Teachers: ${res.data.teachers}
- Classes: ${res.data.classes}
- Subjects: ${res.data.subjects}
- Teacher Assignments: ${res.data.assignments}
- Class Time Slots: ${res.data.slots}
- Weekdays: ${res.data.weekdays}\n
All metrics should be above zero for the Intelligent Generator to function flawlessly.`);
    } catch (error) {
      toast.error('Could not run diagnostics');
    }
  };

  const fetchTimetable = async () => {
    if (viewType === 'class' && !selectedClass) return;
    if (viewType === 'teacher' && !selectedTeacher) return;
    
    try {
      const endpoint = viewType === 'class' 
        ? `/timetable?classId=${selectedClass}` 
        : `/timetable?teacherId=${selectedTeacher}`;
      const tRes = await api.get(endpoint);
      setTimetable(tRes.data);
    } catch (error) {
      toast.error('Failed to fetch timetable');
    }
  };

  useEffect(() => {
    fetchMetaData();
  }, []);

  useEffect(() => {
    fetchTimetable();
  }, [selectedClass, selectedTeacher, viewType]);

  const exportToPDF = () => {
    const doc = new jsPDF();
    const title = viewType === 'class' 
      ? `Timetable: ${classes.find(c => c.id === selectedClass)?.className || 'Class'}`
      : `Teacher Timetable: ${assignments.find(a => a.teacherId === selectedTeacher)?.teacher.fullname || 'Teacher'}`;

    doc.setFontSize(20);
    doc.text(title, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 30);

    const safeTimetable = Array.isArray(timetable) ? timetable : [];
    const tableData = safeTimetable.map(t => [
      t.weekday?.dayName,
      `${t.timeSlot.startTime} - ${t.timeSlot.endTime}`,
      viewType === 'class' ? t.subject?.subjectName : t.class?.className,
      viewType === 'class' ? t.teacher?.fullname : t.subject?.subjectName
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Weekday', 'Time Slot', viewType === 'class' ? 'Subject' : 'Class', viewType === 'class' ? 'Teacher' : 'Subject']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] }, // Indigo 600
      styles: { cellPadding: 5, fontSize: 10 }
    });

    doc.save(`${title.replace(/[: ]/g, '_')}.pdf`);
  };

  const handleGenerate = async (clearExisting: boolean) => {
    setGenerating(true);
    const toastId = toast.loading('Intelligent engine is optimizing your schedule...');
    try {
      const formattedYear = academicYear.includes('/') ? academicYear : `${academicYear}/${parseInt(academicYear) + 1}`;
      const res = await api.post('/timetable/auto-generate', { 
        clearExisting,
        academicYear: formattedYear
      });
      
      if (res.data.success) {
        toast.success(`Done! Generated ${res.data.count} sessions.`, { id: toastId, duration: 4000 });
      } else {
        toast.error(res.data.message || 'Generation stalled', { id: toastId });
      }

      // Re-fetch all data to update the view
      await fetchMetaData();
      if (selectedClass) {
        await fetchTimetable();
      }
    } catch (error: any) {
      const missing = error.response?.data?.missing;
      const message = error.response?.data?.message || 'Generation failed';
      
      if (missing && Array.isArray(missing)) {
        toast.error(`${message}\n\nRequired: ${missing.join(', ')}`, { id: toastId, duration: 6000 });
      } else {
        toast.error(message, { id: toastId });
      }
    } finally {
      setGenerating(false);
    }
  };

  // Timetable Business Rules configuration for easy tweaking later
  const TIMETABLE_FREE_SLOT_RULES = [
    {
      dayName: 'Wednesday',
      isFreeSlot: (slotIndex: number, totalSlotsCount: number) => {
        // Free slots are defined as the last 3 periods of the day
        return slotIndex >= totalSlotsCount - 3;
      }
    }
  ];

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.weekdayId || !formData.timeSlotId || !formData.classId) {
      toast.error('Please fill all required fields');
      return;
    }

    // Client-side Duplicate & Collision Validation Checks
    const slot = timeSlots.find(s => s.id === formData.timeSlotId);
    if (slot && (slot.slotType || '').toLowerCase() !== 'class') {
      toast.error("Cannot schedule during a break or lunch slot.");
      return;
    }

    // Check school business rules constraint
    const selectedDayObj = weekdays.find(d => d.id === formData.weekdayId);
    if (selectedDayObj) {
      const activeClassSlots = timeSlots.filter(s => (s.slotType || '').toLowerCase() === 'class');
      const classSlotIndex = activeClassSlots.findIndex(s => s.id === formData.timeSlotId);
      const rule = TIMETABLE_FREE_SLOT_RULES.find(
        r => r.dayName.toLowerCase() === selectedDayObj.dayName.toLowerCase()
      );
      if (rule && classSlotIndex !== -1 && rule.isFreeSlot(classSlotIndex, activeClassSlots.length)) {
        toast.error("Wednesday (Kuwa 3) last 3 periods are reserved as FREE blocks. Scheduling lessons is forbidden.");
        return;
      }
    }

    const duplicateCombo = Array.isArray(allEntries) && allEntries.find(entry => 
      entry.classId === formData.classId &&
      entry.weekdayId === formData.weekdayId &&
      entry.timeSlotId === formData.timeSlotId &&
      entry.subjectId === formData.subjectId &&
      (!editingEntry || entry.id !== editingEntry.id)
    );
    if (duplicateCombo) {
      toast.error("This assignment already exists.");
      return;
    }

    const classOccupied = Array.isArray(allEntries) && allEntries.find(entry => 
      entry.classId === formData.classId &&
      entry.weekdayId === formData.weekdayId &&
      entry.timeSlotId === formData.timeSlotId &&
      (!editingEntry || entry.id !== editingEntry.id)
    );
    if (classOccupied) {
      toast.error("Class already occupied.");
      return;
    }

    if (formData.teacherId) {
      const teacherBusy = Array.isArray(allEntries) && allEntries.find(entry => 
        entry.teacherId === formData.teacherId &&
        entry.weekdayId === formData.weekdayId &&
        entry.timeSlotId === formData.timeSlotId &&
        (!editingEntry || entry.id !== editingEntry.id)
      );
      if (teacherBusy) {
        toast.error("Teacher already busy during this time.");
        return;
      }
    }

    setSubmitting(true);
    try {
      if (editingEntry) {
        await api.put(`/timetable/${editingEntry.id}`, formData);
        toast.success('Schedule entry updated');
      } else {
        await api.post('/timetable', formData);
        toast.success('Schedule entry created');
      }
      setShowModal(false);
      setEditingEntry(null);
      fetchMetaData(); // Refresh stats
      fetchTimetable();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to process schedule');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (entry: any) => {
    setEditingEntry(entry);
    setFormData({
      classId: entry.classId,
      subjectId: entry.subjectId,
      teacherId: entry.teacherId,
      timeSlotId: entry.timeSlotId,
      weekdayId: entry.weekdayId
    });
    setShowModal(true);
  };

  const deleteEntry = async (id: string) => {
    try {
      await api.delete(`/timetable/${id}`);
      setTimetable(timetable.filter(t => t.id !== id));
      setDeletingId(null);
      fetchMetaData(); // Refresh stats
      toast.success('Deleted');
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const onAssignmentChange = (assignId: string) => {
    const a = assignments.find(x => x.id === assignId);
    if (a) {
      setFormData({
        ...formData,
        classId: a.classId,
        subjectId: a.subjectId,
        teacherId: a.teacherId
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="col-span-1 md:col-span-2 bg-[#0F172A] p-8 rounded-3xl text-white shadow-xl flex flex-col justify-between relative overflow-hidden"
        >
          <div className="relative z-10">
            <h2 className="text-3xl font-bold mb-2">Smart Auto-Generator</h2>
            <p className="text-slate-400 mb-8 max-w-sm">
              Generate a full weekly timetable in seconds. The engine handles all teacher and class conflicts automatically.
            </p>
            
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={() => handleGenerate(true)} 
                disabled={generating}
                className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-emerald-900/20 hover:bg-emerald-500 transition-all flex items-center gap-3 disabled:opacity-50"
              >
                {generating ? <Loader2 className="animate-spin" size={20} /> : <RefreshCw size={20} />}
                GENERATE NOW
              </button>
              <button 
                onClick={() => {
                  setEditingEntry(null);
                  setFormData({ classId: '', subjectId: '', teacherId: '', timeSlotId: '', weekdayId: weekdays[0]?.id || '' });
                  setShowModal(true);
                }} 
                className="bg-slate-800 text-white border border-slate-700 px-6 py-3 rounded-xl font-medium hover:bg-slate-700 transition-all flex items-center gap-2"
              >
                <Plus size={20} />
                Manual Entry
              </button>
              <button 
                onClick={checkDiagnostics} 
                className="bg-slate-800 text-slate-400 border border-slate-700 px-4 rounded-xl hover:text-white transition-colors"
                title="System Health Check"
              >
                <AlertCircle size={20} />
              </button>
              <button 
                onClick={() => navigate('/admin/timetable/settings')} 
                className="bg-slate-800 text-slate-400 border border-slate-700 px-4 rounded-xl hover:text-white transition-colors"
                title="Generator Settings"
              >
                <Settings size={20} />
              </button>
            </div>
          </div>
          <Sparkles className="absolute right-[-20px] bottom-[-20px] text-white/5 w-64 h-64 rotate-12" />
        </motion.div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-lg mb-4 flex items-center justify-between">
              Readiness Checklist
              <span className="text-[10px] text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full uppercase">Status OK</span>
            </h3>
            <div className="space-y-3">
              <CheckItem label="Weekdays Configured" checked={stats.hasWeekdays} />
              <CheckItem label="Classes Created" checked={stats.hasClasses} />
              <CheckItem label="Instructional Slots" checked={stats.hasClassSlots} />
              <CheckItem label="Teacher Assignments" checked={stats.totalAssignments > 0} />
            </div>
          </div>
          
          <div className="pt-6 border-t border-slate-50 mt-4">
            <div className="flex justify-between text-xs font-bold mb-2">
              <span className="text-slate-400 uppercase tracking-wider">Fill Rate</span>
              <span className="text-emerald-600 font-mono">{Math.round((stats.fulfilledPeriods / (stats.fulfilledPeriods + stats.pendingPeriods || 1)) * 100)}%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${(stats.fulfilledPeriods / (stats.fulfilledPeriods + stats.pendingPeriods || 1)) * 100}%` }}
                className="h-full bg-emerald-500 rounded-full"
              />
            </div>
          </div>
        </div>
      </div>
    
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-50 flex flex-col md:flex-row items-center justify-between gap-4">
           <div className="flex flex-wrap items-center gap-3">
              <div className="flex bg-slate-100 p-1 rounded-xl">
                 <button 
                  onClick={() => setViewType('class')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewType === 'class' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                 >
                   Class View
                 </button>
                 <button 
                  onClick={() => setViewType('teacher')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewType === 'teacher' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                 >
                   Teacher View
                 </button>
              </div>

              <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                {viewType === 'class' ? (
                  <>
                    <Layers size={18} className="text-emerald-600" />
                    <select 
                      className="bg-transparent border-none focus:ring-0 font-bold text-slate-900 cursor-pointer text-sm" 
                      value={selectedClass} 
                      onChange={(e) => setSelectedClass(e.target.value)}
                    >
                      <option value="">Select Class...</option>
                      {Array.isArray(classes) && classes.map(c => <option key={c.id} value={c.id}>{c.className}</option>)}
                    </select>
                  </>
                ) : (
                  <>
                    <Users size={18} className="text-emerald-600" />
                    <select 
                      className="bg-transparent border-none focus:ring-0 font-bold text-slate-900 cursor-pointer text-sm" 
                      value={selectedTeacher} 
                      onChange={(e) => setSelectedTeacher(e.target.value)}
                    >
                      <option value="">Select Teacher...</option>
                      {/* Filter unique teachers from assignments */}
                      {Array.isArray(assignments) && Array.from(new Set(assignments.map(a => a.teacherId))).map(tId => {
                        const teacher = assignments.find(a => a.teacherId === tId)?.teacher;
                        return <option key={tId} value={tId}>{teacher?.fullname}</option>;
                      })}
                    </select>
                  </>
                )}
              </div>
           </div>

           <div className="flex items-center gap-3">
              <button 
                onClick={exportToPDF}
                disabled={timetable.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 transition-colors font-bold text-xs disabled:opacity-50"
              >
                <Download size={16} />
                EXPORT PDF
              </button>
              <div className="hidden md:flex items-center gap-2 text-[10px] uppercase font-bold text-slate-400 tracking-widest pl-4 border-l border-slate-100">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Live View</span>
              </div>
           </div>
        </div>

        <div className="overflow-x-auto font-sans">
          <table className="w-full text-left min-w-[700px]">
            <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider font-bold">
              <tr>
                <th className="px-6 py-4">Weekday</th>
                <th className="px-6 py-4">Time Slot</th>
                <th className="px-6 py-4">{viewType === 'class' ? 'Subject' : 'Class'}</th>
                <th className="px-6 py-4">{viewType === 'class' ? 'Teacher' : 'Subject'}</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (viewType === 'class' ? selectedClass : selectedTeacher) ? (
                 <tr><td colSpan={5} className="px-6 py-12 text-center"><Loader2 className="animate-spin mx-auto text-emerald-600" /></td></tr>
              ) : !(viewType === 'class' ? selectedClass : selectedTeacher) ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400">Select {viewType === 'class' ? 'a class' : 'a teacher'} above to view the schedule.</td></tr>
              ) : timetable.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400">No entries found for this {viewType}.</td></tr>
              ) : (
                timetable.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900">{t.weekday?.dayName}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-slate-400" />
                        <span className="font-semibold text-slate-700">{t.timeSlot.startTime} - {t.timeSlot.endTime}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-emerald-700 uppercase text-xs">
                        {viewType === 'class' ? t.subject?.subjectName : t.class?.className}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs text-slate-500 font-medium">
                        {viewType === 'class' ? t.teacher?.fullname : t.subject?.subjectName}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right min-w-[200px]">
                      {deletingId === t.id ? (
                        <div className="flex items-center justify-end gap-2 text-xs">
                          <span className="text-rose-600 font-semibold animate-pulse mr-1">Remove lesson?</span>
                          <button
                            onClick={() => deleteEntry(t.id)}
                            className="bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setDeletingId(null)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-2.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <div className="space-x-2 flex items-center justify-end">
                          <button 
                            onClick={() => handleEdit(t)}
                            className="text-slate-400 hover:text-emerald-600 transition-colors p-2 hover:bg-emerald-50 rounded-lg cursor-pointer inline-flex items-center"
                            title="Edit Allocation"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => setDeletingId(t.id)}
                            className="text-slate-400 hover:text-rose-600 transition-colors p-2 hover:bg-rose-50 rounded-lg cursor-pointer inline-flex items-center"
                            title="Delete Allocation"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex items-center gap-2">
              <Link2 size={24} className="text-emerald-600" />
              <h3 className="text-xl font-bold text-slate-900">{editingEntry ? 'Edit Allocation' : 'Manual Lesson Allocation'}</h3>
            </div>
            <form onSubmit={handleManualSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Assignment (Class - Subject - Teacher)</label>
                <select 
                  className="input-field" 
                  required
                  onChange={(e) => onAssignmentChange(e.target.value)}
                >
                  <option value="">Choose an assignment</option>
                  {Array.isArray(assignments) && assignments.map(a => (
                    <option key={a.id} value={a.id}>{a.class?.className} - {a.subject?.subjectName} ({a.teacher?.fullname})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Day</label>
                  <select 
                    className="input-field" 
                    value={formData.weekdayId}
                    onChange={(e) => setFormData({...formData, weekdayId: e.target.value})}
                  >
                    {Array.isArray(weekdays) && weekdays.map(d => <option key={d.id} value={d.id}>{d.dayName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Time Slot</label>
                  <select 
                    className="input-field" 
                    required
                    value={formData.timeSlotId}
                    onChange={(e) => setFormData({...formData, timeSlotId: e.target.value})}
                  >
                    <option value="">Select Slot</option>
                    {Array.isArray(timeSlots) && timeSlots.map(s => <option key={s.id} value={s.id}>
                      {s.startTime} ({s.slotType?.toUpperCase()})
                    </option>)}
                  </select>
                </div>
              </div>
              
              <div className="p-3 bg-amber-50 rounded-lg flex items-start gap-3 border border-amber-100">
                <AlertCircle className="text-amber-600 flex-shrink-0" size={18} />
                <p className="text-xs text-amber-700 italic">Advanced collision detection will run upon saving to prevent double-booking teachers or classes.</p>
              </div>

              <div className="flex gap-3 pt-6">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={submitting} className="btn btn-primary flex-1">
                  {submitting ? (editingEntry ? 'Updating...' : 'Validating...') : (editingEntry ? 'Update Allocation' : 'Allocate Lesson')}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function CheckItem({ label, checked }: { label: string, checked: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={checked ? 'text-slate-600' : 'text-slate-400'}>{label}</span>
      {checked ? (
        <div className="w-5 h-5 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
          <Sparkles size={12} />
        </div>
      ) : (
        <div className="w-5 h-5 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center">
          <AlertCircle size={12} />
        </div>
      )}
    </div>
  );
}