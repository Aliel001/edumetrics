import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';
import { 
  Calendar, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  XCircle, 
  Sparkles,
  ClipboardList
} from 'lucide-react';

export default function TeacherAttendance() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [personalLogs, setPersonalLogs] = useState<any[]>([]);
  const [remark, setRemark] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Today's date relative to local timezone
  const getTodayISOString = () => {
    const today = new Date();
    const tzOffset = today.getTimezoneOffset() * 60000;
    return (new Date(Date.now() - tzOffset)).toISOString().slice(0, 10);
  };
  const todayStr = getTodayISOString();

  const fetchPersonalAttendance = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await api.get(`/attendance/teachers?teacherId=${user.id}`);
      setPersonalLogs(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      toast.error('Failed to retrieve personal attendance history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPersonalAttendance();
  }, [user]);

  const handleSelfCheckIn = async (status: 'present' | 'late') => {
    if (!user) return;
    setSubmitting(true);
    const toastId = toast.loading('Registering daily check-in...');
    try {
      await api.post('/attendance/teachers', {
        teacherId: user.id,
        date: todayStr,
        status,
        remark: remark || `Self checked-in via portal as ${status}`
      });
      toast.success(`Check-in registered successfully as ${status}!`, { id: toastId });
      setRemark('');
      fetchPersonalAttendance();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to submit check-in', { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const todayRecord = personalLogs.find(log => log.date === todayStr);

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Daily Portal Check-In</h2>
        <p className="text-slate-500 text-sm">Submit your daily school attendance and review historical registers</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Check-In Card Form */}
        <div className="md:col-span-1 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-base mb-2">Today's Check-In</h3>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold mb-4 bg-slate-50 px-3 py-1.5 rounded-lg w-fit">
              <Calendar size={14} className="text-emerald-500" />
              {todayStr}
            </div>

            {todayRecord ? (
              <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/40 text-center space-y-3">
                <div className="mx-auto h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <CheckCircle size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-emerald-800 text-sm uppercase tracking-wide">Status recorded</h4>
                  <p className="text-xs text-emerald-600 font-mono font-semibold mt-1">
                    Logged: {todayRecord.status.toUpperCase()}
                  </p>
                </div>
                <p className="text-xs text-slate-500 italic border-t border-emerald-100/40 pt-2 mt-2">
                  "{todayRecord.remark || 'No comment provided'}"
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-100/40 text-amber-700 text-xs flex gap-2">
                  <Sparkles size={16} className="text-amber-500 shrink-0 mt-0.5" />
                  <span>You have not checked in for today. Please register your attendance status below.</span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Daily check-in remark</label>
                  <textarea
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    placeholder="E.g., Ready for term evaluations / preparing class worksheets..."
                    className="w-full p-3 rounded-xl border border-slate-200 outline-none text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-400 min-h-[90px]"
                    disabled={submitting}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleSelfCheckIn('present')}
                    disabled={submitting}
                    className="w-full btn bg-emerald-600 text-white hover:bg-emerald-700 flex items-center justify-center gap-1 text-xs sm:text-xs.5 shrink-0 select-none py-2.5 font-bold cursor-pointer"
                  >
                    <CheckCircle size={14} />
                    Present
                  </button>
                  <button
                    onClick={() => handleSelfCheckIn('late')}
                    disabled={submitting}
                    className="w-full btn bg-amber-500 text-white hover:bg-amber-600 flex items-center justify-center gap-1 text-xs shrink-0 select-none py-2.5 font-bold cursor-pointer"
                  >
                    <Clock size={14} />
                    Late
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Attendance Registered Log list */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100 bg-slate-50/30">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
              <ClipboardList size={16} className="text-emerald-600" />
              Attendance History Log
            </h3>
            <p className="text-xs text-slate-401 mt-0.5">Summary ledger of your checked attendance records</p>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left min-w-[500px]">
              <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase font-bold tracking-wider border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">Logged Date</th>
                  <th className="px-6 py-4">Check-In Status</th>
                  <th className="px-6 py-4">Your Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-slate-400">
                      <div className="space-y-1.5 flex flex-col items-center justify-center">
                        <Clock className="animate-spin text-emerald-500" size={20} />
                        <span className="text-xs font-semibold">Retrieving history ledger...</span>
                      </div>
                    </td>
                  </tr>
                ) : personalLogs.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-slate-450 text-xs">
                      No previous logs found. Mark your first check-in today!
                    </td>
                  </tr>
                ) : (
                  personalLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-slate-700 text-xs">
                        {log.date}
                      </td>
                      <td className="px-6 py-4">
                        {log.status === 'present' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase">
                            Present
                          </span>
                        )}
                        {log.status === 'late' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100 uppercase">
                            Late
                          </span>
                        )}
                        {log.status === 'absent' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-100 uppercase">
                            Absent
                          </span>
                        )}
                        {log.status === 'excused' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-500 border border-indigo-100 uppercase">
                            Excused
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 italic text-slate-500 text-xs text-slate-550 max-w-xs truncate">
                        {log.remark}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
