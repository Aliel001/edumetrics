import React from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { 
  Users, 
  UserCircle, 
  Layers, 
  BookOpen, 
  ClipboardCheck, 
  FileText, 
  LayoutDashboard, 
  LogOut, 
  ChevronRight,
  GraduationCap,
  Search,
  Clock,
  Calendar,
  Sparkles,
  Menu,
  X,
  Sun,
  Moon
} from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import { getSchoolNameFromId } from './lib/schoolUtils';
import { motion, AnimatePresence } from 'motion/react';
import api from './lib/api';

// Pages
import AdminSetup from './pages/AdminSetup';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Teachers from './pages/admin/Teachers';
import Classes from './pages/admin/Classes';
import Subjects from './pages/admin/Subjects';
import Students from './pages/admin/Students';
import Assignments from './pages/admin/Assignments';
import TimeSlots from './pages/admin/TimeSlots';
import TimetableManager from './pages/admin/TimetableManager';
import GeneratorSettings from './pages/admin/GeneratorSettings';
import Branding from './pages/admin/Branding';
import Timetables from './pages/Timetables';
import MarkEntry from './pages/teacher/MarkEntry';
import Reports from './pages/Reports';
import TeacherAttendanceAdmin from './pages/admin/TeacherAttendance';
import TeacherAttendanceTeacher from './pages/teacher/TeacherAttendance';
import StudentAttendance from './pages/StudentAttendance';
import CalendarYearPicker from './components/CalendarYearPicker';
import GlobalSearch from './components/GlobalSearch';
import LoadingScreen from './components/LoadingScreen';

const SidebarItem = ({ to, icon: Icon, label, active, onClick }: { to: string, icon: any, label: string, active: boolean, onClick?: () => void }) => (
  <Link to={to} onClick={onClick} className={`sidebar-item ${active ? 'active' : ''}`}>
    <Icon size={16} />
    <span className="text-sm font-medium">{label}</span>
  </Link>
);

const ProtectedRoute = ({ children, roles }: { children: React.ReactNode, roles?: ('admin' | 'teacher' | 'dos')[] }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role as any)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const BrandingRouteGuard = ({ children }: { children: React.ReactNode }) => {
  const { user, branding, refreshBranding } = useAuth();
  const [isVerifying, setIsVerifying] = React.useState(true);

  const userId = user?.id;
  const hasBranding = !!branding;

  React.useEffect(() => {
    let isMounted = true;
    const verify = async () => {
      // Only request from the API if branding is not already loaded
      if (userId && !hasBranding) {
        try {
          await refreshBranding();
        } catch (err) {
          console.error("BrandingRouteGuard error: failed to verify/refresh school branding configuration profile", err);
        }
      }
      if (isMounted) {
        setIsVerifying(false);
      }
    };
    verify();
    return () => {
      isMounted = false;
    };
  }, [userId, hasBranding, refreshBranding]);

  if (isVerifying) {
    return <LoadingScreen />;
  }

  return <>{children}</>;
};

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { user, logout, academicYear, setAcademicYear, branding } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  const adminMenu = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/admin/teachers', icon: UserCircle, label: 'Staff Management' },
    { to: '/admin/teacher-attendance', icon: ClipboardCheck, label: 'Teacher Attendance' },
    { to: '/admin/classes', icon: Layers, label: 'Classes' },
    { to: '/admin/subjects', icon: BookOpen, label: 'Subjects' },
    { to: '/admin/students', icon: GraduationCap, label: 'Students' },
    { to: '/admin/student-attendance', icon: Users, label: 'Student Attendance' },
    { to: '/admin/assignments', icon: ClipboardCheck, label: 'Assignments' },
    { to: '/admin/time-slots', icon: Clock, label: 'Time Slots' },
    { to: '/admin/timetable', icon: Calendar, label: 'Timetable Builder' },
    { to: '/timetable', icon: Layers, label: 'View Timetables' },
    { to: '/reports', icon: FileText, label: 'Reports' },
    { to: '/admin/branding', icon: Sparkles, label: 'School Branding' },
  ];

  const dosMenu = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/admin/time-slots', icon: Clock, label: 'Time Slots' },
    { to: '/admin/timetable', icon: Calendar, label: 'Timetable Builder' },
    { to: '/timetable', icon: Layers, label: 'View Timetables' },
    { to: '/reports', icon: FileText, label: 'Reports / Cards' },
  ];

  const teacherMenu = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/teacher/attendance', icon: ClipboardCheck, label: 'Portal Check-In' },
    { to: '/teacher/marks', icon: ClipboardCheck, label: 'Enter Marks' },
    { to: '/teacher/student-attendance', icon: Users, label: 'Student Attendance' },
    { to: '/timetable', icon: Calendar, label: 'My Timetable' },
    { to: '/reports', icon: FileText, label: 'Reports / Cards' },
  ];

  const menu = user?.role === 'admin' ? adminMenu : (user?.role === 'dos' ? dosMenu : teacherMenu);

  const schoolDisplayName = React.useMemo(() => {
    return getSchoolNameFromId(user?.school_id);
  }, [user]);

  return (
    <div className="flex h-screen overflow-hidden relative">
      {/* Mobile Sidebar Backdrop */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/60 z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white flex-shrink-0 flex flex-col border-r border-slate-100 transition-transform duration-300 md:translate-x-0 md:relative md:flex
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <img 
              src={branding?.logo_url || "/edumetric.png"} 
              alt="School Logo" 
              className="w-8 h-8 object-contain rounded-lg shadow-sm flex-shrink-0"
              referrerPolicy="no-referrer"
            />
            <span className="text-slate-900 text-lg font-bold tracking-tight truncate">{schoolDisplayName}</span>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-50 md:hidden transition-colors flex-shrink-0"
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          <div className="text-logo-700/80 text-[10px] uppercase font-bold tracking-widest px-2 mb-2">Management</div>
          {menu.map((item) => (
            <SidebarItem 
              key={item.to} 
              to={item.to} 
              icon={item.icon} 
              label={item.label} 
              active={location.pathname === item.to}
              onClick={() => setIsSidebarOpen(false)}
            />
          ))}
        </nav>

        <div className="p-4 bg-slate-50/50 border-t border-slate-100">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-logo-100 flex items-center justify-center text-xs font-bold text-logo-800 uppercase">
              {user?.fullname.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{user?.fullname}</p>
              <p className="text-xs text-slate-400 uppercase truncate font-bold font-mono text-[9px]">
                {user?.role === 'dos' ? 'DOS' : user?.role}
              </p>
            </div>
          </div>
          <button 
            onClick={() => {
              setIsSidebarOpen(false);
              logout();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-slate-500 hover:text-logo-700 hover:bg-logo-50/50 transition-all outline-none"
          >
            <LogOut size={16} />
            <span className="text-sm font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 sticky top-0 z-10 flex-shrink-0">
          <div className="flex items-center gap-3 text-sm min-w-0">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 md:hidden flex-shrink-0"
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2 md:gap-4 min-w-0">
              <CalendarYearPicker value={academicYear} onChange={setAcademicYear} />
              <span className="text-slate-300 hidden sm:inline">/</span>
              <span className="text-slate-900 font-bold truncate max-w-[120px] sm:max-w-none">
                {menu.find(m => m.to === location.pathname)?.label || 'Dashboard'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <div className="hidden lg:block">
              <GlobalSearch />
            </div>
            <button
              id="theme-toggle-btn"
              onClick={toggleTheme}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none flex items-center justify-center border border-slate-200"
              title={theme === 'light' ? 'Switch to Late-Night Grading Dark Mode' : 'Switch to Light Mode'}
              aria-label="Toggle dark mode"
            >
              {theme === 'light' ? (
                <Moon size={18} className="text-slate-600" />
              ) : (
                <Sun size={18} className="text-amber-400" />
              )}
            </button>
          </div>
        </header>

        <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default function App() {
  const { isLoading } = useAuth();
  const [adminExists, setAdminExists] = React.useState<boolean | null>(null);
  const location = useLocation();

  React.useEffect(() => {
    api.get('/auth/check-admin')
      .then(res => {
        setAdminExists(res.data.exists);
      })
      .catch(() => {
        setAdminExists(true); // secure fallback
      });
  }, [location.pathname]);

  if (isLoading || adminExists === null) {
    return <LoadingScreen />;
  }

  // Secure: Redirect to Admin Setup on missing admin
  if (!adminExists && location.pathname !== '/admin-setup' && location.pathname !== '/reset-password') {
    return <Navigate to="/admin-setup" replace />;
  }

  // Secure: Lock setup screen if admin account exists
  if (adminExists && location.pathname === '/admin-setup') {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/admin-setup" element={<AdminSetup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        
        <Route path="/*" element={
          <ProtectedRoute>
            <BrandingRouteGuard>
              <DashboardLayout>
                <Routes>
                  <Route path="/dashboard" element={<Dashboard />} />
                  
                  {/* Admin-only Routes */}
                  <Route path="/admin/teachers" element={<ProtectedRoute roles={['admin']}><Teachers /></ProtectedRoute>} />
                  <Route path="/admin/teacher-attendance" element={<ProtectedRoute roles={['admin']}><TeacherAttendanceAdmin /></ProtectedRoute>} />
                  <Route path="/admin/classes" element={<ProtectedRoute roles={['admin']}><Classes /></ProtectedRoute>} />
                  <Route path="/admin/subjects" element={<ProtectedRoute roles={['admin']}><Subjects /></ProtectedRoute>} />
                  <Route path="/admin/students" element={<ProtectedRoute roles={['admin']}><Students /></ProtectedRoute>} />
                  <Route path="/admin/student-attendance" element={<ProtectedRoute roles={['admin']}><StudentAttendance /></ProtectedRoute>} />
                  <Route path="/admin/assignments" element={<ProtectedRoute roles={['admin']}><Assignments /></ProtectedRoute>} />
                  <Route path="/admin/branding" element={<ProtectedRoute roles={['admin']}><Branding /></ProtectedRoute>} />
                  
                  {/* Timetable-specific admin-and-dos Routes */}
                  <Route path="/admin/time-slots" element={<ProtectedRoute roles={['admin', 'dos']}><TimeSlots /></ProtectedRoute>} />
                  <Route path="/admin/timetable" element={<ProtectedRoute roles={['admin', 'dos']}><TimetableManager /></ProtectedRoute>} />
                  <Route path="/admin/timetable/settings" element={<ProtectedRoute roles={['admin', 'dos']}><GeneratorSettings /></ProtectedRoute>} />
                  
                  {/* Teacher-only Routes */}
                  <Route path="/teacher/marks" element={<ProtectedRoute roles={['teacher']}><MarkEntry /></ProtectedRoute>} />
                  <Route path="/teacher/attendance" element={<ProtectedRoute roles={['teacher']}><TeacherAttendanceTeacher /></ProtectedRoute>} />
                  <Route path="/teacher/student-attendance" element={<ProtectedRoute roles={['teacher']}><StudentAttendance /></ProtectedRoute>} />
                  
                  {/* Shared authenticated routes */}
                  <Route path="/reports" element={<ProtectedRoute roles={['admin', 'dos', 'teacher']}><Reports /></ProtectedRoute>} />
                  <Route path="/timetable" element={<ProtectedRoute roles={['admin', 'dos', 'teacher']}><Timetables /></ProtectedRoute>} />
                  
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </DashboardLayout>
            </BrandingRouteGuard>
          </ProtectedRoute>
        } />
      </Routes>
    </>
  );
}
