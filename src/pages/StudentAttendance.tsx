import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { 
  Calendar, 
  Search, 
  UserCheck, 
  UserX, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  ClipboardList, 
  CalendarRange, 
  Save, 
  HelpCircle,
  Users,
  Layers,
  Sparkles,
  RefreshCw,
  PlusCircle,
  FileSpreadsheet
} from 'lucide-react';

export default function StudentAttendance() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  
  // Roster list for the selected class and date
  const [roster, setRoster] = useState<any[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Date State
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    const tzOffset = today.getTimezoneOffset() * 60000;
    return (new Date(Date.now() - tzOffset)).toISOString().slice(0, 10);
  });

  const [activeTab, setActiveTab] = useState<'daily' | 'history'>('daily');
  
  // History ledger state
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFilterClass, setHistoryFilterClass] = useState('');
  const [historyFilterStatus, setHistoryFilterStatus] = useState('');

  // Remark editing states
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [tempRemark, setTempRemark] = useState('');

  // Load classes initially
  useEffect(() => {
    const loadClasses = async () => {
      try {
        const res = await api.get('/classes');
        const classList = Array.isArray(res.data) ? res.data : [];
        setClasses(classList);
        if (classList.length > 0) {
          setSelectedClassId(classList[0].id);
        }
      } catch (err) {
        toast.error('Failed to load classes list');
      }
    };
    loadClasses();
  }, []);

  // Load daily class attendance roster
  const loadDailyRoster = async () => {
    if (!selectedClassId) return;
    setLoadingRoster(true);
    try {
      const res = await api.get(`/attendance/students?classId=${selectedClassId}&date=${selectedDate}`);
      setRoster(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      toast.error('Failed to retrieve student roster');
    } finally {
      setLoadingRoster(false);
    }
  };

  // Load history ledger logs
  const loadHistoryLogs = async () => {
    setHistoryLoading(true);
    try {
      const classParam = historyFilterClass ? `&classId=${historyFilterClass}` : '';
      const res = await api.get(`/attendance/students?${classParam}`);
      setHistoryRecords(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      toast.error('Failed to load structural history ledger');
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'daily') {
      loadDailyRoster();
    } else {
      loadHistoryLogs();
    }
  }, [selectedClassId, selectedDate, activeTab, historyFilterClass]);

  // Update status for a single student instantly
  const handleUpdateStatus = async (studentId: string, status: string, currentRemark: string = '') => {
    try {
      await api.post('/attendance/students', {
        studentId,
        classId: selectedClassId,
        date: selectedDate,
        status,
        remark: currentRemark
      });
      // Hot updates without full reload for instant beautiful snap satisfaction
      setRoster(prev => prev.map(s => s.studentId === studentId ? { ...s, status } : s));
      toast.success('Attendance state saved');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update student state');
    }
  };

  // Save specific student remark/note
  const handleSaveRemark = async (studentId: string, status: string) => {
    try {
      await api.post('/attendance/students', {
        studentId,
        classId: selectedClassId,
        date: selectedDate,
        status,
        remark: tempRemark
      });
      setRoster(prev => prev.map(s => s.studentId === studentId ? { ...s, remark: tempRemark } : s));
      toast.success('Remark added to ledger');
      setEditingStudentId(null);
    } catch (error) {
      toast.error('Failed to save student remark');
    }
  };

  // Custom high-efficiency "Mark All Present" button setup
  const handleMarkAllPresent = async () => {
    if (roster.length === 0) return;
    const toastId = toast.loading('Logging class-wide checkout...');
    try {
      const recordsToPost = roster.map(item => ({
        studentId: item.studentId,
        status: 'present',
        remark: item.remark || ''
      }));

      await api.post('/attendance/students/bulk', {
        date: selectedDate,
        classId: selectedClassId,
        records: recordsToPost
      });

      toast.success('All matching students successfully marked Present!', { id: toastId });
      loadDailyRoster();
    } catch (error) {
      toast.error('Failed to mark class present in bulk', { id: toastId });
    }
  };

  // Custom high-efficiency "Submit Class Roster" button setup
  const handleSubmitFullRoster = async () => {
    if (roster.length === 0) return;
    const toastId = toast.loading('Submitting finalized class ledger...');
    try {
      // Find all students whose status is still unrecorded and make them present/absent accordingly
      // For safe logging, we submit all records
      const recordsToPost = roster.map(item => ({
        studentId: item.studentId,
        status: item.status === 'unrecorded' ? 'present' : item.status, // Default unrecorded to present
        remark: item.remark || ''
      }));

      await api.post('/attendance/students/bulk', {
        date: selectedDate,
        classId: selectedClassId,
        records: recordsToPost
      });

      toast.success('Daily class attendance register finalized!', { id: toastId });
      loadDailyRoster();
    } catch (e) {
      toast.error('Failed to save finalized roster', { id: toastId });
    }
  };

  // Filter local roster list by name
  const filteredRoster = roster.filter(st => {
    const fullName = `${st.firstname || ''} ${st.lastname || ''}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase());
  });

  // Calculate statistics for current class/date sheet
  const stats = {
    total: roster.length,
    present: roster.filter(s => s.status === 'present').length,
    absent: roster.filter(s => s.status === 'absent').length,
    late: roster.filter(s => s.status === 'late').length,
    excused: roster.filter(s => s.status === 'excused').length,
    unrecorded: roster.filter(s => s.status === 'unrecorded' || !s.status).length
  };

  // Filter historical register
  const filteredHistory = historyRecords.filter(rec => {
    if (historyFilterStatus && rec.status !== historyFilterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Dynamic Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="text-emerald-500" size={24} />
            Student Attendance Portal
          </h2>
          <p className="text-slate-500 text-sm">
            {user?.role === 'admin' 
              ? 'Institutional student registry check-in. Manage, audit, and inspect student registers.' 
              : 'Classroom roll call check-in interface. Log daily attendance records for students.'}
          </p>
        </div>
        
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Class Select */}
          {activeTab === 'daily' && (
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mr-1">Class:</span>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
              >
                {classes.map(cl => (
                  <option key={cl.id} value={cl.id}>{cl.className}</option>
                ))}
              </select>
            </div>
          )}

          {/* Date Picker */}
          {activeTab === 'daily' && (
            <div className="relative shadow-sm rounded-lg">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/15"
              />
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100">
        <button
          onClick={() => setActiveTab('daily')}
          className={`px-4 py-2.5 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'daily'
              ? 'border-emerald-500 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ClipboardList size={16} />
          Daily Classroom Roster
        </button>
        <button
          onClick={() => {
            setActiveTab('history');
            if (classes.length > 0 && !historyFilterClass) {
              setHistoryFilterClass(classes[0].id);
            }
          }}
          className={`px-4 py-2.5 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'history'
              ? 'border-emerald-500 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CalendarRange size={16} />
          Master Ledger & Audit History
        </button>
      </div>

      {activeTab === 'daily' ? (
        <>
          {/* Daily Quick Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                <Users size={12} className="text-slate-400" />
                Enrollment
              </div>
              <div className="text-2xl font-black text-slate-800">{stats.total}</div>
            </div>

            <div className="bg-emerald-50/55 p-4 rounded-xl border border-emerald-100/50">
              <div className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1 flex items-center gap-1">
                <CheckCircle size={12} />
                Present
              </div>
              <div className="text-2xl font-black text-emerald-700">{stats.present}</div>
            </div>

            <div className="bg-rose-50/55 p-4 rounded-xl border border-rose-100/50">
              <div className="text-xs font-bold text-rose-600 uppercase tracking-widest mb-1 flex items-center gap-1">
                <XCircle size={12} />
                Absent
              </div>
              <div className="text-2xl font-black text-rose-700">{stats.absent}</div>
            </div>

            <div className="bg-amber-50/55 p-4 rounded-xl border border-amber-100/50">
              <div className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-1 flex items-center gap-1">
                <Clock size={12} />
                Late
              </div>
              <div className="text-2xl font-black text-amber-700">{stats.late}</div>
            </div>

            <div className="bg-indigo-50/55 p-4 rounded-xl border border-indigo-100/50">
              <div className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1 flex items-center gap-1">
                <AlertCircle size={12} />
                Excused
              </div>
              <div className="text-2xl font-black text-indigo-700">{stats.excused}</div>
            </div>

            <div className="bg-slate-100/60 p-4 rounded-xl border border-slate-200/40">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                <HelpCircle size={12} />
                Remaining
              </div>
              <div className="text-2xl font-black text-slate-600">{stats.unrecorded}</div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-slate-50/60 p-4 rounded-xl border border-slate-100">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text"
                placeholder="Search students in class..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-250 rounded-lg text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-400"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handleMarkAllPresent}
                disabled={filteredRoster.length === 0}
                className="bg-white hover:bg-slate-50 text-emerald-600 border border-emerald-250 rounded-xl px-4 py-2 text-xs font-bold flex items-center justify-center gap-1.5 transition-all w-full sm:w-auto shadow-sm active:scale-95 cursor-pointer"
              >
                <Sparkles size={14} className="text-emerald-500" />
                Mark All Present
              </button>
              
              <button
                onClick={handleSubmitFullRoster}
                disabled={filteredRoster.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-4 py-2 text-xs font-bold flex items-center justify-center gap-1.5 transition-all w-full sm:w-auto shadow-sm active:scale-95 cursor-pointer"
              >
                <Save size={14} />
                Save & Conclude Class
              </button>
            </div>
          </div>

          {/* Daily roster grid */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[750px]">
                <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider font-bold border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4">Student Profile</th>
                    <th className="px-6 py-4">Attendance Status</th>
                    <th className="px-6 py-4">Roll Call Action Status</th>
                    <th className="px-6 py-4">Note / Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingRoster ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <RefreshCw className="animate-spin text-emerald-500" size={24} />
                          <span className="text-sm font-semibold">Generating classroom seat plan...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredRoster.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                        No students enrolled in this class yet. Admin can create students in Student Registry.
                      </td>
                    </tr>
                  ) : (
                    filteredRoster.map((student) => {
                      const currentStatus = student.status || 'unrecorded';

                      return (
                        <tr key={student.studentId} className="hover:bg-slate-50/40 transition-colors">
                          {/* Student name & avatar */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold uppercase text-xs">
                                {student.firstname.charAt(0)}{student.lastname.charAt(0)}
                              </div>
                              <div>
                                <h4 className="font-bold text-slate-800 text-sm">
                                  {student.firstname} {student.lastname}
                                </h4>
                                <p className="text-xs text-slate-400 capitalize font-medium">{student.gender}</p>
                              </div>
                            </div>
                          </td>

                          {/* Status Badge */}
                          <td className="px-6 py-4">
                            {currentStatus === 'present' && (
                              <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold font-mono px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Present
                              </span>
                            )}
                            {currentStatus === 'absent' && (
                              <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold font-mono px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 border border-rose-100 uppercase">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Absent
                              </span>
                            )}
                            {currentStatus === 'late' && (
                              <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold font-mono px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-100 uppercase">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Late
                              </span>
                            )}
                            {currentStatus === 'excused' && (
                              <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold font-mono px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-500 border border-indigo-100 uppercase">
                                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" /> Excused
                              </span>
                            )}
                            {currentStatus === 'unrecorded' && (
                              <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold font-mono px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200/50 uppercase">
                                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Unrecorded
                              </span>
                            )}
                          </td>

                          {/* Quick tap actions */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={() => handleUpdateStatus(student.studentId, 'present', student.remark)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                  currentStatus === 'present'
                                    ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                                    : 'bg-slate-50 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600'
                                }`}
                              >
                                Present
                              </button>
                              <button 
                                onClick={() => handleUpdateStatus(student.studentId, 'absent', student.remark)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                  currentStatus === 'absent'
                                    ? 'bg-rose-600 text-white shadow-sm font-semibold'
                                    : 'bg-slate-50 text-slate-600 hover:bg-rose-50 hover:text-rose-600'
                                }`}
                              >
                                Absent
                              </button>
                              <button 
                                onClick={() => handleUpdateStatus(student.studentId, 'late', student.remark)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                  currentStatus === 'late'
                                    ? 'bg-amber-500 text-white shadow-sm font-semibold'
                                    : 'bg-slate-50 text-slate-600 hover:bg-amber-50 hover:text-amber-600'
                                }`}
                              >
                                Late
                              </button>
                              <button 
                                onClick={() => handleUpdateStatus(student.studentId, 'excused', student.remark)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                  currentStatus === 'excused'
                                    ? 'bg-indigo-500 text-white shadow-sm font-semibold'
                                    : 'bg-slate-50 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'
                                }`}
                              >
                                Excused
                              </button>
                            </div>
                          </td>

                          {/* Remarks column */}
                          <td className="px-6 py-4">
                            {editingStudentId === student.studentId ? (
                              <div className="flex items-center gap-1.5 max-w-xs">
                                <input 
                                  type="text"
                                  value={tempRemark}
                                  onChange={(e) => setTempRemark(e.target.value)}
                                  placeholder="Type remark..."
                                  className="px-2 py-1.5 text-xs text-slate-800 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 w-full"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveRemark(student.studentId, currentStatus);
                                  }}
                                />
                                <button 
                                  onClick={() => handleSaveRemark(student.studentId, currentStatus)}
                                  className="p-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                                >
                                  <Save size={14} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-2 group min-h-[30px]">
                                <span className={`text-xs ${student.remark ? 'text-slate-600 font-medium' : 'text-slate-400 italic'}`}>
                                  {student.remark || 'Click to write remark'}
                                </span>
                                <button 
                                  onClick={() => {
                                    setEditingStudentId(student.studentId);
                                    setTempRemark(student.remark || '');
                                  }}
                                  className="text-[10px] font-bold text-slate-400 hover:text-emerald-600 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                                >
                                  Edit Note
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Historical Register Ledger */
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden space-y-4">
          <div className="p-5 border-b border-slate-100 bg-slate-50/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Attendance History Audit Register Ledger</h3>
              <p className="text-xs text-slate-400 mt-0.5">Chronological feed of all recorded student daily attendance logs</p>
            </div>

            {/* Quick history filters */}
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Select Category */}
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs">
                <span className="text-slate-400 font-bold">Class:</span>
                <select
                  value={historyFilterClass}
                  onChange={(e) => setHistoryFilterClass(e.target.value)}
                  className="bg-transparent outline-none font-bold text-slate-700 cursor-pointer"
                >
                  <option value="">All Classes</option>
                  {classes.map(cl => (
                    <option key={cl.id} value={cl.id}>{cl.className}</option>
                  ))}
                </select>
              </div>

              {/* Select Status */}
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs">
                <span className="text-slate-400 font-bold">Status:</span>
                <select
                  value={historyFilterStatus}
                  onChange={(e) => setHistoryFilterStatus(e.target.value)}
                  className="bg-transparent outline-none font-bold text-slate-705 cursor-pointer uppercase"
                >
                  <option value="">All Statuses</option>
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="late">Late</option>
                  <option value="excused">Excused</option>
                </select>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[750px]">
              <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider font-bold border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">Logged Date</th>
                  <th className="px-6 py-4">Student Profile</th>
                  <th className="px-6 py-4">Class Room</th>
                  <th className="px-6 py-4">Attendance Status</th>
                  <th className="px-6 py-4">Registered By</th>
                  <th className="px-6 py-4">Administrator Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historyLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="animate-spin text-emerald-500" size={18} />
                        <span className="text-sm font-semibold">Retrieving student logs registers...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      No records registered yet. Use the daily roster grid to select a class and submit check-ins.
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-slate-700 text-xs">
                        {rec.date}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-800 text-sm">
                        {rec.studentName}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/50">
                          {rec.className}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {rec.status === 'present' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase">
                            Present
                          </span>
                        )}
                        {rec.status === 'absent' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-100 uppercase">
                            Absent
                          </span>
                        )}
                        {rec.status === 'late' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100 uppercase">
                            Late
                          </span>
                        )}
                        {rec.status === 'excused' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-500 border border-indigo-100 uppercase">
                            Excused
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-600 text-xs">
                        {rec.teacherName}
                      </td>
                      <td className="px-6 py-4 italic text-slate-500 text-xs">
                        {rec.remark || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
