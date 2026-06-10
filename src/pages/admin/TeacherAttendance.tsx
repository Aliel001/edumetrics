import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
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
  Users
} from 'lucide-react';

export default function TeacherAttendance() {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    const tzOffset = today.getTimezoneOffset() * 60000; // local time offset
    const localISOTime = (new Date(Date.now() - tzOffset)).toISOString().slice(0, 10);
    return localISOTime;
  });

  const [activeTab, setActiveTab] = useState<'daily' | 'history'>('daily');
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  // Note/remark state
  const [editingRemarkId, setEditingRemarkId] = useState<string | null>(null);
  const [tempRemark, setTempRemark] = useState('');

  const loadDailyData = async () => {
    setLoading(true);
    try {
      const [teachersRes, attendanceRes] = await Promise.all([
        api.get('/teachers'),
        api.get(`/attendance/teachers?date=${selectedDate}`)
      ]);
      setTeachers(Array.isArray(teachersRes.data) ? teachersRes.data.filter((u: any) => u.role === 'teacher') : []);
      setAttendance(Array.isArray(attendanceRes.data) ? attendanceRes.data : []);
    } catch (error) {
      toast.error('Failed to load daily attendance data');
    } finally {
      setLoading(false);
    }
  };

  const loadHistoryLogs = async () => {
    setHistoryLoading(true);
    try {
      const res = await api.get('/attendance/teachers');
      setHistoryRecords(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      toast.error('Failed to load attendance logs history');
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'daily') {
      loadDailyData();
    } else {
      loadHistoryLogs();
    }
  }, [selectedDate, activeTab]);

  const handleUpdateAttendance = async (teacherId: string, status: string, remark: string = '') => {
    const toastId = toast.loading('Saving attendance...');
    try {
      await api.post('/attendance/teachers', {
        teacherId,
        date: selectedDate,
        status,
        remark: remark
      });
      toast.success('Attendance updated successfully', { id: toastId });
      loadDailyData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update attendance', { id: toastId });
    }
  };

  const handleSaveRemark = async (teacherId: string, status: string) => {
    try {
      await api.post('/attendance/teachers', {
        teacherId,
        date: selectedDate,
        status,
        remark: tempRemark
      });
      toast.success('Remark updated');
      setEditingRemarkId(null);
      loadDailyData();
    } catch (error) {
      toast.error('Failed to save remark');
    }
  };

  // Filter daily staff
  const filteredTeachers = teachers.filter((t) => 
    (t.fullname || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Compute stats for current selected date
  const stats = {
    total: teachers.length,
    present: attendance.filter(a => a.status === 'present').length,
    absent: attendance.filter(a => a.status === 'absent').length,
    late: attendance.filter(a => a.status === 'late').length,
    excused: attendance.filter(a => a.status === 'excused').length,
    unrecorded: teachers.length - attendance.filter(a => ['present', 'absent', 'late', 'excused'].includes(a.status)).length
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Teacher Attendance</h2>
          <p className="text-slate-500 text-sm">Monitor staff logs, submit daily attendance reports, and inspect logs</p>
        </div>
        
        {/* Date Selector and Tabs */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-705 focus:outline-none focus:ring-2 focus:ring-logo-500/20"
            />
          </div>
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
          Daily Attendance Grid
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2.5 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'history'
              ? 'border-emerald-500 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CalendarRange size={16} />
          Logs / Historical Register
        </button>
      </div>

      {activeTab === 'daily' ? (
        <>
          {/* Key Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-100">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                <Users size={12} />
                Total Staff
              </div>
              <div className="text-xl font-extrabold text-slate-800">{stats.total}</div>
            </div>
            
            <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100/40">
              <div className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                <CheckCircle size={12} />
                Present
              </div>
              <div className="text-xl font-extrabold text-emerald-600">{stats.present}</div>
            </div>

            <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-100/40">
              <div className="text-xs font-bold text-rose-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                <XCircle size={12} />
                Absent
              </div>
              <div className="text-xl font-extrabold text-rose-600">{stats.absent}</div>
            </div>

            <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100/40">
              <div className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                <Clock size={12} />
                Late
              </div>
              <div className="text-xl font-extrabold text-amber-600">{stats.late}</div>
            </div>

            <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/40">
              <div className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                <AlertCircle size={12} />
                Excused
              </div>
              <div className="text-xl font-extrabold text-indigo-600">{stats.excused}</div>
            </div>

            <div className="bg-slate-100/60 p-4 rounded-xl border border-slate-200/45">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                <HelpCircle size={12} />
                Pending
              </div>
              <div className="text-xl font-extrabold text-slate-600">{stats.unrecorded}</div>
            </div>
          </div>

          {/* Table Area */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Search filter bar */}
            <div className="p-4 sm:p-5 border-b border-slate-50 bg-slate-50/50">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Search staff members..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-logo-500/20 text-sm font-semibold text-slate-700 focus:border-logo-400"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[750px]">
                <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider font-bold border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4">Staff Member</th>
                    <th className="px-6 py-4">Current Status</th>
                    <th className="px-6 py-4">Register daily check-in / Override</th>
                    <th className="px-6 py-4 text-left">Remark / Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Clock className="animate-spin text-emerald-500" size={24} />
                          <span className="text-sm font-semibold">Retrieving daily logs...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredTeachers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                        No teachers found. Click Staff Management tab to create accounts.
                      </td>
                    </tr>
                  ) : (
                    filteredTeachers.map((teacher) => {
                      const record = attendance.find(a => a.teacherId === teacher.id);
                      const currentStatus = record ? record.status : 'unrecorded';
                      
                      return (
                        <tr key={teacher.id} className="hover:bg-slate-50/50 transition-colors">
                          {/* Staff name & email */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-slate-100 border border-slate-250 flex items-center justify-center text-slate-700 font-bold uppercase text-xs">
                                {teacher.fullname.charAt(0)}
                              </div>
                              <div>
                                <h4 className="font-bold text-slate-800 text-sm">{teacher.fullname}</h4>
                                <p className="text-xs text-slate-400 font-semibold">{teacher.email}</p>
                              </div>
                            </div>
                          </td>

                          {/* Status Badge */}
                          <td className="px-6 py-4">
                            {currentStatus === 'present' && (
                              <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold font-mono tracking-wide px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Present
                              </span>
                            )}
                            {currentStatus === 'absent' && (
                              <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold font-mono tracking-wide px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 border border-rose-100 uppercase">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Absent
                              </span>
                            )}
                            {currentStatus === 'late' && (
                              <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold font-mono tracking-wide px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-100 uppercase">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Late
                              </span>
                            )}
                            {currentStatus === 'excused' && (
                              <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold font-mono tracking-wide px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-500 border border-indigo-100 uppercase">
                                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" /> Excused
                              </span>
                            )}
                            {currentStatus === 'unrecorded' && (
                              <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold font-mono tracking-wide px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200/50 uppercase">
                                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Unrecorded
                              </span>
                            )}
                          </td>

                          {/* Trigger Update Buttons group */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={() => handleUpdateAttendance(teacher.id, 'present', record?.remark || '')}
                                title="Mark Present"
                                className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-all ${
                                  currentStatus === 'present'
                                    ? 'bg-emerald-600 text-white shadow-sm'
                                    : 'bg-slate-50 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600'
                                }`}
                              >
                                Present
                              </button>
                              <button 
                                onClick={() => handleUpdateAttendance(teacher.id, 'absent', record?.remark || '')}
                                title="Mark Absent"
                                className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-all ${
                                  currentStatus === 'absent'
                                    ? 'bg-rose-600 text-white shadow-sm'
                                    : 'bg-slate-50 text-slate-600 hover:bg-rose-50 hover:text-rose-600'
                                }`}
                              >
                                Absent
                              </button>
                              <button 
                                onClick={() => handleUpdateAttendance(teacher.id, 'late', record?.remark || '')}
                                title="Mark Late"
                                className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-all ${
                                  currentStatus === 'late'
                                    ? 'bg-amber-500 text-white shadow-sm'
                                    : 'bg-slate-50 text-slate-600 hover:bg-amber-50 hover:text-amber-600'
                                }`}
                              >
                                Late
                              </button>
                              <button 
                                onClick={() => handleUpdateAttendance(teacher.id, 'excused', record?.remark || '')}
                                title="Mark Excused"
                                className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-all ${
                                  currentStatus === 'excused'
                                    ? 'bg-indigo-500 text-white shadow-sm'
                                    : 'bg-slate-50 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'
                                }`}
                              >
                                Excused
                              </button>
                            </div>
                          </td>

                          {/* Remarks column */}
                          <td className="px-6 py-4">
                            {editingRemarkId === teacher.id ? (
                              <div className="flex items-center gap-1.5 max-w-xs">
                                <input 
                                  type="text"
                                  value={tempRemark}
                                  onChange={(e) => setTempRemark(e.target.value)}
                                  placeholder="Type remark..."
                                  className="px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveRemark(teacher.id, currentStatus);
                                  }}
                                />
                                <button 
                                  onClick={() => handleSaveRemark(teacher.id, currentStatus)}
                                  className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                                >
                                  <Save size={14} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-2 group">
                                <span className="text-xs text-slate-600 italic">
                                  {record?.remark || 'No extra remarks'}
                                </span>
                                <button 
                                  onClick={() => {
                                    setEditingRemarkId(teacher.id);
                                    setTempRemark(record?.remark || '');
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
        /* Historical Register list */
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/20">
            <h3 className="font-bold text-slate-800 text-sm">Attendance History Register Ledger</h3>
            <p className="text-xs text-slate-400 mt-0.5">Chronological feed of all recorded teacher daily attendance check-ins</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[700px]">
              <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider font-bold border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">Logged Date</th>
                  <th className="px-6 py-4">Teacher Name</th>
                  <th className="px-6 py-4">Attendance Status</th>
                  <th className="px-6 py-4">Administrator Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historyLoading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <Clock className="animate-spin text-emerald-500" size={18} />
                        <span className="text-sm font-semibold">Loading historic logs...</span>
                      </div>
                    </td>
                  </tr>
                ) : historyRecords.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      No records registered yet. Use the daily tab to start checking staff.
                    </td>
                  </tr>
                ) : (
                  historyRecords.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-slate-700 text-xs">
                        {rec.date}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-800 text-sm">
                        {rec.teacherName}
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
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-550 border border-indigo-100 uppercase">
                            Excused
                          </span>
                        )}
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
