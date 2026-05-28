import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { 
  Search, 
  GraduationCap, 
  UserSquare, 
  Layers, 
  BookOpen, 
  FileText, 
  LayoutDashboard,
  Calendar,
  Loader2,
  X,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SearchResult {
  id: string;
  type: 'student' | 'teacher' | 'class' | 'subject' | 'page';
  title: string;
  subtitle?: string;
  url: string;
  icon: any;
}

export default function GlobalSearch() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Loaded database resources cache
  const [students, setStudents] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [hasLoadedData, setHasLoadedData] = useState(false);

  // Available accessible pages by role
  const getPages = (): SearchResult[] => {
    const defaultPages: SearchResult[] = [
      { id: 'p1', type: 'page', title: 'Dashboard', subtitle: 'View performance and live metrics', url: '/dashboard', icon: LayoutDashboard },
      { id: 'p2', type: 'page', title: 'Reports & Grades', subtitle: 'Print transcripts and report cards', url: '/reports', icon: FileText },
      { id: 'p3', type: 'page', title: 'View Timetables', subtitle: 'Class period and lesson schedules', url: '/timetable', icon: Calendar },
    ];

    if (user?.role === 'admin') {
      return [
        ...defaultPages,
        { id: 'p4', type: 'page', title: 'Manage Teachers', subtitle: 'School staff list and accounts', url: '/admin/teachers', icon: UserSquare },
        { id: 'p5', type: 'page', title: 'Manage Classes', subtitle: 'Form groups and streams', url: '/admin/classes', icon: Layers },
        { id: 'p6', type: 'page', title: 'Manage Subjects', subtitle: 'Curriculum subjects list', url: '/admin/subjects', icon: BookOpen },
        { id: 'p7', type: 'page', title: 'Manage Students', subtitle: 'Enroll and assign pupils', url: '/admin/students', icon: GraduationCap },
        { id: 'p8', type: 'page', title: 'Class Assignments', subtitle: 'Teachers assigned to classes', url: '/admin/assignments', icon: Layers },
        { id: 'p9', type: 'page', title: 'Auto Timetable Generator', subtitle: 'Genetic algorithm schedules', url: '/admin/timetable', icon: Sparkles },
      ];
    } else {
      return [
        ...defaultPages,
        { id: 'p10', type: 'page', title: 'Enter Marks', subtitle: 'Input student assessment data', url: '/teacher/marks', icon: BookOpen },
      ];
    }
  };

  const loadSearchData = async () => {
    if (hasLoadedData || loading) return;
    setLoading(true);
    try {
      const [studentsRes, teachersRes, classesRes, subjectsRes] = await Promise.all([
        api.get('/students').catch(() => ({ data: [] })),
        user?.role === 'admin' || user?.role === 'teacher' ? api.get('/teachers').catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        api.get('/classes').catch(() => ({ data: [] })),
        api.get('/subjects').catch(() => ({ data: [] }))
      ]);

      setStudents(Array.isArray(studentsRes.data) ? studentsRes.data : []);
      setTeachers(Array.isArray(teachersRes.data) ? teachersRes.data : []);
      setClasses(Array.isArray(classesRes.data) ? classesRes.data : []);
      setSubjects(Array.isArray(subjectsRes.data) ? subjectsRes.data : []);
      setHasLoadedData(true);
    } catch (err) {
      console.error('Failed to pre-fetch search resources', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFocus = () => {
    setIsOpen(true);
    loadSearchData();
  };

  // Click outside detection
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter items based on user input
  const getFilteredResults = (): SearchResult[] => {
    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase().trim();

    if (!lowerQuery) {
      // Suggesting standard pages as shortcut on blank input
      return getPages();
    }

    // 1. Pages
    getPages().forEach(page => {
      if (
        page.title.toLowerCase().includes(lowerQuery) ||
        (page.subtitle && page.subtitle.toLowerCase().includes(lowerQuery))
      ) {
        results.push(page);
      }
    });

    // 2. Classes
    classes.forEach(c => {
      if (c.className && c.className.toLowerCase().includes(lowerQuery)) {
        results.push({
          id: `class-${c.id}`,
          type: 'class',
          title: c.className,
          subtitle: 'Active Academic Class',
          url: user?.role === 'admin' ? '/admin/classes' : '/timetable',
          icon: Layers
        });
      }
    });

    // 3. Subjects
    subjects.forEach(s => {
      if (s.subjectName && s.subjectName.toLowerCase().includes(lowerQuery)) {
        results.push({
          id: `subject-${s.id}`,
          type: 'subject',
          title: s.subjectName,
          subtitle: s.subjectCode ? `${s.subjectCode} - Subject Course` : 'Subject Course',
          url: user?.role === 'admin' ? '/admin/subjects' : '/teacher/marks',
          icon: BookOpen
        });
      }
    });

    // 4. Students
    students.forEach(s => {
      const fullname = `${s.firstname || ''} ${s.lastname || ''}`.trim();
      if (fullname.toLowerCase().includes(lowerQuery)) {
        results.push({
          id: `student-${s.id}`,
          type: 'student',
          title: fullname,
          subtitle: `Student • Class ${s.class?.className || 'Unassigned'} • Term Records`,
          url: user?.role === 'admin' ? '/admin/students' : '/reports',
          icon: GraduationCap
        });
      }
    });

    // 5. Teachers
    teachers.forEach(t => {
      if (
        (t.fullname && t.fullname.toLowerCase().includes(lowerQuery)) ||
        (t.email && t.email.toLowerCase().includes(lowerQuery))
      ) {
        results.push({
          id: `teacher-${t.id}`,
          type: 'teacher',
          title: t.fullname,
          subtitle: `Teacher • ${t.email}`,
          url: user?.role === 'admin' ? '/admin/teachers' : '/dashboard',
          icon: UserSquare
        });
      }
    });

    return results;
  };

  const filteredResults = getFilteredResults();

  // Reset active index when query changes
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev + 1) % Math.max(1, filteredResults.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev - 1 + filteredResults.length) % Math.max(1, filteredResults.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredResults[activeIndex]) {
        handleSelect(filteredResults[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleSelect = (result: SearchResult) => {
    navigate(result.url);
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div className="relative w-64 md:w-80" ref={containerRef}>
      {/* Search Input Bar */}
      <div className="relative">
        <input 
          type="text" 
          placeholder="Search students, classes, subjects..." 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          className="w-full pl-9 pr-8 py-2 bg-slate-100 hover:bg-slate-200/50 focus:bg-white border border-transparent focus:border-logo-500 rounded-xl text-sm transition-all outline-none text-slate-800 font-medium"
        />
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
        
        {query && (
          <button 
            onClick={() => setQuery('')}
            className="absolute right-2.5 top-2.5 p-0.5 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Popover Floating Search Engine Results */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 mt-2 w-full min-w-[320px] md:min-w-[360px] bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden text-left"
          >
            {/* Header / Loading feedback */}
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                {query ? 'Search Results Engine' : 'Jump To Section'}
              </span>
              {loading && (
                <div className="flex items-center gap-1.5 text-logo-600 text-[10px] font-mono font-bold animate-pulse">
                  <Loader2 size={11} className="animate-spin" />
                  Updating Cache
                </div>
              )}
            </div>

            {/* Results list */}
            <div className="max-h-[350px] overflow-y-auto p-2 space-y-1">
              {filteredResults.length > 0 ? (
                filteredResults.map((result, index) => {
                  const Icon = result.icon;
                  const isSelected = index === activeIndex;

                  return (
                    <button
                      key={result.id}
                      onClick={() => handleSelect(result)}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-start gap-3 border ${
                        isSelected 
                          ? 'bg-logo-50/75 border-logo-200/50' 
                          : 'bg-white border-transparent hover:bg-slate-50'
                      }`}
                    >
                      <div className={`p-2 rounded-lg flex-shrink-0 ${
                        isSelected ? 'bg-logo-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        <Icon size={14} />
                      </div>
                      <div className="min-w-0 flex-1 leading-snug">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-slate-900 truncate pr-2">
                            {result.title}
                          </p>
                          <span className="text-[9px] uppercase font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            {result.type}
                          </span>
                        </div>
                        {result.subtitle && (
                          <p className="text-[10px] text-slate-400 mt-1 truncate font-mono">
                            {result.subtitle}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="py-8 text-center px-4">
                  <p className="text-sm font-semibold text-slate-800">No resources matched your search</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Try entering different names, subjects, classes, or roles.
                  </p>
                </div>
              )}
            </div>

            {/* Sticky bottom guide */}
            <div className="bg-slate-50 border-t border-slate-100 px-4 py-2 flex items-center justify-between text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider">
              <span>↑↓ Arrow keys to navigate</span>
              <span>Enter to select</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
