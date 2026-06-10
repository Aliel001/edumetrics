import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { 
  Users, 
  GraduationCap, 
  Layers, 
  BookOpen, 
  Calendar,
  Sparkles,
  Award,
  Activity,
  PlusCircle,
  HelpCircle,
  Clock
} from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

interface Stats {
  students: number;
  teachers: number;
  classes: number;
  subjects: number;
  performance: Array<{ name: string; avg: number }>;
  activities: Array<{ user: string; action: string; target: string; time: string }>;
}

const StatCard = ({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) => (
  <div className="stats-card flex items-center justify-between p-6">
    <div>
      <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">{label}</div>
      <div className="text-3xl font-bold text-slate-900 leading-none">{value.toLocaleString()}</div>
    </div>
    <div className={`h-11 w-11 rounded-xl flex items-center justify-center text-white ${color} shadow-sm shadow-emerald-500/5`}>
      <Icon size={20} />
    </div>
  </div>
);

export default function Dashboard() {
  const { user, academicYear, branding } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'dos') {
      setLoading(true);
      api.get(`/stats?year=${academicYear}`)
        .then(res => setStats(res.data))
        .catch(err => console.error('Error fetching dashboard stats:', err))
        .finally(() => setLoading(false));
    } else if (user?.role === 'teacher') {
      setAssignmentsLoading(true);
      api.get('/teacher/assignments')
        .then(res => setAssignments(res.data))
        .catch(err => console.error('Error fetching teacher assignments:', err))
        .finally(() => setAssignmentsLoading(false));
    }
  }, [user, academicYear]);

  const hasRealPerformance = stats?.performance && stats.performance.some((p: any) => p.avg > 0);
  const chartData = hasRealPerformance ? stats.performance : [];

  const formatYearLabel = (yr: string) => {
    const start = parseInt(yr || '2026');
    return `${start}/${(start + 1).toString().substring(2)}`;
  };

  const getFriendlyTime = (dateStr: string) => {
    try {
      const past = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - past.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHrs = Math.floor(diffMins / 60);
      if (diffHrs < 24) return `${diffHrs}h ago`;
      return past.toLocaleDateString();
    } catch {
      return '';
    }
  };

  if (user?.role === 'teacher') {
    return (
      <div className="space-y-8 animate-fade-in">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-logo-50 to-logo-50/50 p-8 rounded-2xl border border-logo-100/40 relative overflow-hidden text-left flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="relative z-10 flex-1">
            <h2 className="text-2xl font-bold text-slate-900">Welcome back, {user.fullname}! 👋</h2>
            <p className="text-slate-500 mt-2 max-w-xl">
              You are signed in as a teacher for Academic Year <span className="font-semibold text-logo-600 font-mono">{formatYearLabel(academicYear)}</span>.
            </p>
            <div className="flex flex-wrap gap-4 mt-8">
              <Link to="/teacher/marks" className="btn btn-primary inline-flex items-center gap-1.5 shadow-md">
                <PlusCircle size={16} />
                Record Student Marks
              </Link>
              <Link to="/timetable" className="btn btn-secondary inline-flex items-center gap-1.5">
                <Calendar size={16} />
                View Full Timetable Schedule
              </Link>
            </div>
          </div>
          <div className="relative z-10 shrink-0 self-start md:self-auto bg-white p-2.5 rounded-2xl border border-slate-100/80 shadow-xs">
            <img 
              src={branding?.logo_url || "/edumetric.png"} 
              alt="School Logo" 
              className="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded-xl"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="absolute right-0 bottom-0 opacity-10 p-4 pointer-events-none">
            <GraduationCap size={200} />
          </div>
        </div>

        {/* Real-time Teacher Assignments Board */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
          <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm">
            <h3 className="font-bold text-slate-950 mb-4 flex items-center gap-2">
              <Sparkles size={18} className="text-logo-600 animate-pulse" />
              Your Active Class Allocations
            </h3>
            <p className="text-xs text-slate-400 mb-6 font-medium">
              Real-time assigned classes and subjects allocated by administration context for this workspace.
            </p>

            <div className="space-y-4">
              {assignmentsLoading ? (
                <div className="flex flex-col gap-3 py-6 items-center justify-center">
                   <div className="h-6 w-6 border-2 border-logo-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-slate-500 font-mono">Querying live allocations...</p>
                </div>
              ) : assignments && assignments.length > 0 ? (
                assignments.map((assignment, i) => (
                  <div key={assignment.id || i} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-logo-200 transition-colors">
                    <div>
                      <p className="font-bold text-slate-900 font-sans tracking-tight">{assignment.class?.className} • {assignment.subject?.subjectName}</p>
                      <p className="text-xs text-slate-400 font-mono mt-1 flex items-center gap-1">
                        <Clock size={11} className="text-slate-400" />
                        {assignment.periodsPerWeek} Periods Per Week Allocation
                      </p>
                    </div>
                    <Link 
                      to="/teacher/marks" 
                      className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-logo-50 hover:bg-logo-100 text-logo-700 transition"
                      title="Enter assessment grades"
                    >
                      Enter Marks
                    </Link>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl px-4 bg-slate-50/50">
                  <HelpCircle size={32} className="text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-800">No live class assignments</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    There are no registered class allotments associated with your profile for {formatYearLabel(academicYear)}.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in text-left">
      {/* Active Academic Year Banner */}
      <div className="bg-gradient-to-r from-logo-50 to-logo-50/50 p-6 rounded-2xl border border-logo-100/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-white p-1.5 rounded-xl border border-slate-100 shadow-xs flex-shrink-0">
            <img 
              src={branding?.logo_url || "/edumetric.png"} 
              alt="School Logo" 
              className="w-12 h-12 object-contain rounded-lg"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-950">
              Academic Performance Dashboard — {formatYearLabel(academicYear)}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Real-time analytics, evaluation records, and teacher events updated live.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {user?.role === 'admin' && (
            <Link 
              to="/admin/branding" 
              className="btn btn-primary text-xs inline-flex items-center gap-1.5 font-bold shadow-sm"
              title="Change logo and theme colors"
            >
              <Sparkles size={13} />
              Branding Settings
            </Link>
          )}
          <div className="font-mono text-left bg-white px-4 py-2 border border-slate-200 shadow-sm rounded-xl min-w-[100px]">
            <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">ACTIVE SCOPE</span>
            <span className="text-sm font-bold text-slate-800">{formatYearLabel(academicYear)}</span>
          </div>
        </div>
      </div>

      {/* Grid Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          label="Total Students" 
          value={stats?.students ?? 0} 
          icon={GraduationCap} 
          color="bg-logo-600"
        />
        <StatCard 
          label="Total Teachers" 
          value={stats?.teachers ?? 0} 
          icon={Users} 
          color="bg-logo-500"
        />
        <StatCard 
          label="Total Classes" 
          value={stats?.classes ?? 0} 
          icon={Layers} 
          color="bg-amber-600"
        />
        <StatCard 
          label="Total Subjects" 
          value={stats?.subjects ?? 0} 
          icon={BookOpen} 
          color="bg-logo-600"
        />
      </div>

      {/* Analytics Graph & Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Performance Chart with Clean Fallback empty-state */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-150 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[420px]">
          {loading && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] flex flex-col items-center justify-center z-10 rounded-xl gap-2">
              <div className="h-6 w-6 border-2 border-logo-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-logo-700 font-bold text-xs font-mono">Syncing database charts...</span>
            </div>
          )}

          <div className="mb-6">
            <h3 className="text-base font-bold text-slate-950 flex items-center gap-2">
              <Award size={18} className="text-logo-600" />
              Class Performance Averages
            </h3>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              Real-time arithmetic aggregate score averages derived across evaluation templates.
            </p>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            {hasRealPerformance ? (
              <div className="h-80 w-full animate-fade-in">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#022E66" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#022E66" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} dy={10} />
                    <YAxis unit="%" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} domain={[0, 100]} />
                    <Tooltip 
                      contentStyle={{borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)'}}
                      formatter={(value) => [`${value}%`, 'Class Average']}
                    />
                    <Area type="monotone" dataKey="avg" stroke="#022E66" strokeWidth={3} fillOpacity={1} fill="url(#colorAvg)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-12 px-6 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 m-2 flex flex-col items-center justify-center">
                <Award size={36} className="text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-800">No Assessment Performance Recorded</p>
                <p className="text-xs text-slate-500 mt-1.5 max-w-md">
                  There are no scores loaded in Term databases for Academic Year {formatYearLabel(academicYear)}. Once teachers enter assessment grades, real-time averages will render here.
                </p>
                <div className="mt-4">
                  <Link to="/teacher/marks" className="btn btn-secondary text-xs inline-flex items-center gap-1.5 font-bold">
                    <PlusCircle size={13} />
                    Enter Marks Now
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Activity Stream with Clean Fallback empty-state */}
        <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[420px]">
          {loading && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] flex flex-col items-center justify-center z-10 rounded-xl gap-2">
              <div className="h-6 w-6 border-2 border-logo-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-logo-700 font-bold text-xs font-mono">Syncing activity records...</span>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-950 flex items-center gap-2">
                <Activity size={18} className="text-logo-600" />
                Real-Time stream
              </h3>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">
                {formatYearLabel(academicYear)}
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-6 font-medium">
              Live audit events tracked from exam marks, registrations, and scores entered into database.
            </p>

            <div className="space-y-5">
              {stats?.activities && stats.activities.length > 0 ? (
                stats.activities.map((activity, i) => (
                  <div key={i} className="flex gap-3 text-left">
                    <div className="h-1.5 w-1.5 rounded-full bg-logo-500 mt-1.5 flex-shrink-0 animate-pulse" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-800 break-words leading-relaxed">
                        <span className="font-bold text-slate-950">{activity.user}</span> {activity.action} <span className="font-semibold text-logo-600">{activity.target}</span>
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{getFriendlyTime(activity.time)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl px-4 bg-slate-50/50">
                  <Activity size={24} className="text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-800">No Stream Activity Registered</p>
                  <p className="text-[11px] text-slate-500 mt-1 block">
                    No active recordings detected for academic scope.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="w-full mt-6 pt-4 text-center border-t border-slate-100">
            <span className="text-[10px] text-slate-400 font-mono font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5">
              <Sparkles size={11} className="text-amber-500 animate-spin-slow" />
              Live Workspace Tracking
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
