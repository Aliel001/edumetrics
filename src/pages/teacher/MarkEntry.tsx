import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { toast } from 'react-hot-toast';
import { Loader2, Save, CheckCircle, Smartphone, Monitor, BookOpen, Layers, Settings, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import CalendarYearPicker from '../../components/CalendarYearPicker';

export default function MarkEntry() {
  const { academicYear } = useAuth();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [marks, setMarks] = useState<Record<string, { fa: string, ca: string, pa: string, sa: string }>>({});
  const [loading, setLoading] = useState(true);
  const [fetchingStudents, setFetchingStudents] = useState(false);
  const [saving, setSaving] = useState(false);

  const [term, setTerm] = useState('Term 1');
  const [year, setYear] = useState(academicYear);

  const [subjectWeight, setSubjectWeight] = useState<number | null>(null);
  const [subjectPeriods, setSubjectPeriods] = useState<number | null>(null);

  // Mandatory category: Differentiate between test and exam marks
  const [assessmentMode, setAssessmentMode] = useState<'test' | 'exam' | ''>('');

  useEffect(() => {
    setYear(academicYear);
  }, [academicYear]);

  useEffect(() => {
    api.get('/teacher/assignments')
      .then(res => setAssignments(Array.isArray(res.data) ? res.data : []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedAssignment) return;

    const loadStudentsAndMarks = async () => {
      setFetchingStudents(true);
      try {
        const [studentsRes, marksRes] = await Promise.all([
          api.get(`/students/by-class/${selectedAssignment.classId}`),
          api.get(`/assessments?subjectId=${selectedAssignment.subjectId}&term=${term}&academicYear=${year}`)
        ]);
        
        setStudents(Array.isArray(studentsRes.data) ? studentsRes.data : []);
        
        // Initialize marks map
        const marksMap: any = {};
        if (Array.isArray(marksRes.data)) {
          marksRes.data.forEach((m: any) => {
            marksMap[m.studentId] = { 
              fa: (m.formativeAssessment ?? 0).toString(), 
              ca: (m.comprehensiveAssessment ?? 0).toString(), 
              pa: (m.practicalAssessment ?? 0).toString(), 
              sa: (m.summativeAssessment ?? 0).toString() 
            };
          });
        }
        setMarks(marksMap);

        if (Array.isArray(marksRes.data) && marksRes.data.length > 0) {
          setSubjectWeight(marksRes.data[0].subjectWeight ?? 0);
          setSubjectPeriods(marksRes.data[0].periods ?? 0);
        } else {
          setSubjectWeight(selectedAssignment.subject?.subjectWeight ?? 0);
          setSubjectPeriods(selectedAssignment.subject?.periodsPerWeek ?? 0);
        }
      } catch (error) {
        toast.error('Failed to load student profiles');
      } finally {
        setFetchingStudents(false);
      }
    };

    loadStudentsAndMarks();
  }, [selectedAssignment, term, year]);

  const handleAssignmentSelect = (assignment: any) => {
    setSelectedAssignment(assignment);
    setSubjectWeight(assignment.subject?.subjectWeight ?? 0);
    setSubjectPeriods(assignment.subject?.periodsPerWeek ?? 0);
  };

  const handleMarkChange = (studentId: string, field: 'fa' | 'ca' | 'pa' | 'sa', value: string) => {
    if (!assessmentMode) {
      toast.error('Please select whether these marks are for a Test or an Exam first', { id: 'select-mode-first' });
      return;
    }
    setMarks(prev => ({
      ...prev,
      [studentId]: {
        ...((prev[studentId] || { fa: '0', ca: '0', pa: '0', sa: '0' })),
        [field]: value
      }
    }));
  };

  const saveMarks = async (studentId: string) => {
    if (!assessmentMode) {
      toast.error('Submission Blocked: You must select whether you are submitting a Test or an Exam grade category.', { id: 'mode-error' });
      return;
    }

    const studentMarks = marks[studentId] || { fa: '0', ca: '0', pa: '0', sa: '0' };
    
    try {
      await api.post('/assessments', {
        studentId,
        subjectId: selectedAssignment.subjectId,
        formativeAssessment: studentMarks.fa || '0',
        comprehensiveAssessment: studentMarks.ca || '0',
        practicalAssessment: studentMarks.pa || '0',
        summativeAssessment: studentMarks.sa || '0',
        term,
        year: year.split('/')[0] || '2026',
        academicYear: year
      });
      toast.success('Student grades updated successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to sync grades to database');
    }
  };

  const calculateGrade = (total: number) => {
    if (total >= 80) return 'A';
    if (total >= 70) return 'B';
    if (total >= 60) return 'C';
    if (total >= 50) return 'D';
    return 'F';
  };

  const calculateCompetency = (total: number) => {
    if (total >= 80) return 'Highly Competent';
    if (total >= 70) return 'Competent';
    if (total >= 50) return 'Basic Competent';
    return 'Not Yet Competent';
  };

  const finalizeAllMarks = async () => {
    if (!assessmentMode) {
      toast.error('Submission Blocked: You must select whether you are submitting a Test or an Exam grade category.', { id: 'mode-error' });
      return;
    }

    setSaving(true);
    try {
      const promises = students.map(s => {
        const studentMarks = marks[s.id] || { fa: '0', ca: '0', pa: '0', sa: '0' };
        return api.post('/assessments', {
          studentId: s.id,
          subjectId: selectedAssignment.subjectId,
          formativeAssessment: studentMarks.fa || '0',
          comprehensiveAssessment: studentMarks.ca || '0',
          practicalAssessment: studentMarks.pa || '0',
          summativeAssessment: studentMarks.sa || '0',
          term,
          year: year.split('/')[0] || '2026',
          academicYear: year
        });
      });
      await Promise.all(promises);
      toast.success(`All ${assessmentMode === 'test' ? 'Test' : 'Exam'} assessments successfully saved & finalized!`, { id: 'finalized-toast' });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error executing transactional grade sync');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-logo-600" size={40} /></div>;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Session choosing banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <BookOpen className="text-logo-600" size={24} />
          <h2 className="text-xl font-bold text-slate-900 leading-tight">Select Teaching Session</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.isArray(assignments) && assignments.map((a) => (
            <button
              key={a.id}
              onClick={() => handleAssignmentSelect(a)}
              className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                selectedAssignment?.id === a.id 
                  ? 'border-logo-500 bg-logo-50/50 ring-2 ring-logo-500/10' 
                  : 'border-slate-100 hover:border-slate-200 bg-slate-50/25'
              }`}
            >
              <p className="font-bold text-slate-950 text-base">{a.class.className}</p>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mt-1">{a.subject.subjectName}</p>
            </button>
          ))}
        </div>
      </div>

      {selectedAssignment && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Header configuration segment */}
          <div className="p-6 md:p-8 border-b border-slate-50 flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-slate-50/20">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-logo-100 text-logo-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  {selectedAssignment.class.className}
                </span>
                <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  {selectedAssignment.subject.subjectName}
                </span>
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 mt-2.5 leading-snug">
                Student Marks Gradebook
              </h3>
              <p className="text-slate-500 text-xs font-semibold mt-1">
                Calculate continuous assessments (formative, comprehensive, practical) and final exams.
              </p>
            </div>

            {/* Config & Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              {/* Term Selector */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 font-sans">Academic Term</span>
                <select 
                  className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 bg-white hover:bg-slate-50 outline-none cursor-pointer focus:ring-2 focus:ring-logo-500/10 focus:border-logo-400 h-[44px] transition-all" 
                  value={term} 
                  onChange={e => setTerm(e.target.value)}
                >
                  <option value="Term 1">Term 1</option>
                  <option value="Term 2">Term 2</option>
                  <option value="Term 3">Term 3</option>
                </select>
              </div>

              {/* Year Selector */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 font-sans">Academic Year</span>
                <CalendarYearPicker value={year} onChange={setYear} />
              </div>

              {/* Mandatory Assessment Differentiator Choice */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 font-sans">Assessment Type</span>
                <select
                  required
                  className={`px-3.5 py-2.5 rounded-xl border text-sm font-extrabold outline-none cursor-pointer h-[44px] transition-all ${
                    assessmentMode === 'test' 
                      ? 'border-indigo-400 bg-indigo-50/50 text-indigo-900 focus:ring-indigo-500/20' 
                      : assessmentMode === 'exam' 
                        ? 'border-emerald-400 bg-emerald-50/50 text-emerald-900 focus:ring-emerald-500/20' 
                        : 'border-orange-300 bg-orange-50/20 text-orange-900 focus:ring-orange-500/20 animate-pulse'
                  }`}
                  value={assessmentMode}
                  onChange={(e) => setAssessmentMode(e.target.value as any)}
                >
                  <option value="">-- Click to Choose --</option>
                  <option value="test">Test Marks (FA / CA / PA)</option>
                  <option value="exam">Exam Marks (SA)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Locked warning banner if no assessmentType is chosen */}
          {!assessmentMode && (
            <div className="p-6 bg-orange-50/80 border-b border-orange-100 flex items-start gap-3.5 text-orange-850">
              <AlertCircle className="text-orange-650 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-sm font-bold">Category Selection Required</p>
                <p className="text-xs text-orange-700/90 font-medium mt-1">
                  The system requires defining whether marks are recorded under the **Test** or **Exam** category before inputs are enabled. Please click on "Assessment Type" first.
                </p>
              </div>
            </div>
          )}

          {/* Desktop view: Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left min-w-[1200px]">
              <thead className="bg-[#0F172A] text-slate-200 text-[10px] uppercase font-bold tracking-widest border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Student Name</th>
                  <th className={`px-4 py-4 w-32 tracking-wider ${assessmentMode === 'test' ? 'bg-indigo-950/40 text-indigo-200' : 'opacity-40'}`}>
                    FA (Formative)
                  </th>
                  <th className={`px-4 py-4 w-32 tracking-wider ${assessmentMode === 'test' ? 'bg-indigo-950/40 text-indigo-200' : 'opacity-40'}`}>
                    CA (Comprehensive)
                  </th>
                  <th className={`px-4 py-4 w-32 tracking-wider ${assessmentMode === 'test' ? 'bg-indigo-950/40 text-indigo-200' : 'opacity-40'}`}>
                    PA (Practical)
                  </th>
                  <th className={`px-4 py-4 w-32 tracking-wider ${assessmentMode === 'exam' ? 'bg-emerald-950/40 text-emerald-250' : 'opacity-40'}`}>
                    SA (Exam)
                  </th>
                  <th className="px-4 py-4 text-center">Cumulative Total</th>
                  <th className="px-4 py-4 text-center">Subject Weight</th>
                  <th className="px-4 py-4 text-center">Weighted Score</th>
                  <th className="px-4 py-4 text-center">Grade</th>
                  <th className="px-6 py-4 text-center">Competency</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {fetchingStudents ? (
                  <tr>
                    <td colSpan={11} className="px-6 py-20 text-center text-slate-400 text-xs">
                      <Loader2 className="animate-spin mx-auto mb-2 text-logo-600" />
                      Loading class list and grades...
                    </td>
                  </tr>
                ) : (
                  Array.isArray(students) && students.map((s) => {
                    const studentMarks = marks[s.id] || { fa: '0', ca: '0', pa: '0', sa: '0' };
                    const rawFa = parseFloat(studentMarks.fa) || 0;
                    const rawCa = parseFloat(studentMarks.ca) || 0;
                    const rawPa = parseFloat(studentMarks.pa) || 0;
                    const rawSa = parseFloat(studentMarks.sa) || 0;
                    
                    const total = rawFa + rawCa + rawPa + rawSa;
                    const grade = calculateGrade(total);
                    const competency = calculateCompetency(total);

                    return (
                      <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-extrabold text-slate-900 text-sm whitespace-nowrap">{s.firstname} {s.lastname}</p>
                        </td>
                        <td className={`px-4 py-4 ${assessmentMode === 'test' ? 'bg-indigo-50/10' : ''}`}>
                          <input 
                            type="number" 
                            disabled={!assessmentMode || assessmentMode !== 'test'}
                            step="any"
                            min="0"
                            placeholder="FA Mark"
                            className="w-24 px-3 py-2 rounded-xl border border-slate-200 bg-white font-mono text-center focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none font-bold text-sm disabled:bg-slate-50 disabled:text-slate-400"
                            value={studentMarks.fa}
                            onChange={(e) => handleMarkChange(s.id, 'fa', e.target.value)}
                          />
                        </td>
                        <td className={`px-4 py-4 ${assessmentMode === 'test' ? 'bg-indigo-50/10' : ''}`}>
                          <input 
                            type="number" 
                            disabled={!assessmentMode || assessmentMode !== 'test'}
                            step="any"
                            min="0"
                            placeholder="CA Mark"
                            className="w-24 px-3 py-2 rounded-xl border border-slate-200 bg-white font-mono text-center focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none font-bold text-sm disabled:bg-slate-50 disabled:text-slate-400"
                            value={studentMarks.ca}
                            onChange={(e) => handleMarkChange(s.id, 'ca', e.target.value)}
                          />
                        </td>
                        <td className={`px-4 py-4 ${assessmentMode === 'test' ? 'bg-indigo-50/10' : ''}`}>
                          <input 
                            type="number" 
                            disabled={!assessmentMode || assessmentMode !== 'test'}
                            step="any"
                            min="0"
                            placeholder="PA Mark"
                            className="w-24 px-3 py-2 rounded-xl border border-slate-200 bg-white font-mono text-center focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none font-bold text-sm disabled:bg-slate-50 disabled:text-slate-400"
                            value={studentMarks.pa}
                            onChange={(e) => handleMarkChange(s.id, 'pa', e.target.value)}
                          />
                        </td>
                        <td className={`px-4 py-4 ${assessmentMode === 'exam' ? 'bg-emerald-50/10' : ''}`}>
                          <input 
                            type="number" 
                            disabled={!assessmentMode || assessmentMode !== 'exam'}
                            step="any"
                            min="0"
                            placeholder="SA Mark"
                            className="w-24 px-3 py-2 rounded-xl border border-slate-200 bg-white font-mono text-center focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 outline-none font-bold text-sm disabled:bg-slate-50 disabled:text-slate-400"
                            value={studentMarks.sa}
                            onChange={(e) => handleMarkChange(s.id, 'sa', e.target.value)}
                          />
                        </td>
                        <td className="px-4 py-4 text-center font-extrabold text-slate-900 font-mono text-sm">
                          {total.toFixed(0)} / 100
                        </td>
                        <td className="px-4 py-4 text-center text-slate-500 font-bold font-mono">
                          {(subjectWeight ?? 0).toFixed(1)}%
                        </td>
                        <td className="px-4 py-4 text-center font-bold text-logo-700 font-mono text-sm bg-logo-50/30 rounded-xl border border-logo-100/10">
                          {(total * ((subjectWeight ?? 0) / 100)).toFixed(1)}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-black ${
                            grade === 'F' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                          }`}>
                            {grade}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center font-semibold">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase font-bold border ${
                            competency === 'Highly Competent' ? 'bg-emerald-55 bg-emerald-50 text-emerald-700 border-emerald-200' :
                            competency === 'Competent' ? 'bg-teal-50 text-teal-700 border-teal-200' :
                            competency === 'Basic Competent' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {competency}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            disabled={!assessmentMode}
                            onClick={() => saveMarks(s.id)}
                            className="p-2.5 bg-logo-50 text-logo-600 hover:bg-logo-100 disabled:opacity-30 disabled:hover:bg-logo-50 rounded-xl transition-all shadow-sm cursor-pointer inline-flex items-center justify-center border border-logo-100/50"
                          >
                            <Save size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile-friendly swipeable / list card view for easy phone entries */}
          <div className="block md:hidden p-4 space-y-4 bg-slate-50/50 border-t border-slate-100">
            {fetchingStudents ? (
              <div className="py-12 text-center text-slate-400">
                <Loader2 className="animate-spin mx-auto mb-2 text-logo-600" />
                Loading roster...
              </div>
            ) : (
              Array.isArray(students) && students.map((s, index) => {
                const studentMarks = marks[s.id] || { fa: '0', ca: '0', pa: '0', sa: '0' };
                const rawFa = parseFloat(studentMarks.fa) || 0;
                const rawCa = parseFloat(studentMarks.ca) || 0;
                const rawPa = parseFloat(studentMarks.pa) || 0;
                const rawSa = parseFloat(studentMarks.sa) || 0;
                
                const total = rawFa + rawCa + rawPa + rawSa;
                const grade = calculateGrade(total);
                const competency = calculateCompetency(total);

                return (
                  <div key={s.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <span className="text-[10px] bg-slate-100 text-slate-500 rounded px-1.5 py-0.5 font-bold">#{index + 1}</span>
                        <h4 className="font-extrabold text-slate-900 text-base mt-1">{s.firstname} {s.lastname}</h4>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          grade === 'F' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                        }`}>
                          Grade {grade}
                        </span>
                      </div>
                    </div>

                    {/* Numeric Input fields for mobile */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={`block text-[10px] uppercase font-bold text-slate-400 mb-1 ${assessmentMode === 'test' ? 'text-indigo-600 font-black' : ''}`}>
                          FA (Formative)
                        </label>
                        <input 
                          type="number" 
                          disabled={!assessmentMode || assessmentMode !== 'test'}
                          step="any"
                          min="0"
                          className="w-full px-3 py-2 rounded-xl border border-slate-250 bg-white font-mono text-center focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-sm disabled:bg-slate-50 disabled:text-slate-400"
                          value={studentMarks.fa}
                          onChange={(e) => handleMarkChange(s.id, 'fa', e.target.value)}
                        />
                      </div>

                      <div>
                        <label className={`block text-[10px] uppercase font-bold text-slate-400 mb-1 ${assessmentMode === 'test' ? 'text-indigo-600 font-black' : ''}`}>
                          CA (Comprehensive)
                        </label>
                        <input 
                          type="number" 
                          disabled={!assessmentMode || assessmentMode !== 'test'}
                          step="any"
                          min="0"
                          className="w-full px-3 py-2 rounded-xl border border-slate-250 bg-white font-mono text-center focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-sm disabled:bg-slate-50 disabled:text-slate-400"
                          value={studentMarks.ca}
                          onChange={(e) => handleMarkChange(s.id, 'ca', e.target.value)}
                        />
                      </div>

                      <div>
                        <label className={`block text-[10px] uppercase font-bold text-slate-400 mb-1 ${assessmentMode === 'test' ? 'text-indigo-600 font-black' : ''}`}>
                          PA (Practical)
                        </label>
                        <input 
                          type="number" 
                          disabled={!assessmentMode || assessmentMode !== 'test'}
                          step="any"
                          min="0"
                          className="w-full px-3 py-2 rounded-xl border border-slate-250 bg-white font-mono text-center focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-sm disabled:bg-slate-50 disabled:text-slate-400"
                          value={studentMarks.pa}
                          onChange={(e) => handleMarkChange(s.id, 'pa', e.target.value)}
                        />
                      </div>

                      <div>
                        <label className={`block text-[10px] uppercase font-bold text-slate-400 mb-1 ${assessmentMode === 'exam' ? 'text-emerald-600 font-black' : ''}`}>
                          SA (Exam Marks)
                        </label>
                        <input 
                          type="number" 
                          disabled={!assessmentMode || assessmentMode !== 'exam'}
                          step="any"
                          min="0"
                          className="w-full px-3 py-2 rounded-xl border border-slate-250 bg-white font-mono text-center focus:ring-2 focus:ring-emerald-500/20 outline-none font-bold text-sm disabled:bg-slate-50 disabled:text-slate-400"
                          value={studentMarks.sa}
                          onChange={(e) => handleMarkChange(s.id, 'sa', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                      <div className="text-left font-sans text-xs">
                        <span className="text-slate-400 font-medium">Cumulative Score: </span>
                        <span className="font-bold font-mono text-slate-800">{total.toFixed(0)}/100</span>
                      </div>
                      <button 
                        disabled={!assessmentMode}
                        onClick={() => saveMarks(s.id)}
                        className="btn btn-secondary px-3.5 py-1.5 text-xs flex items-center gap-1.5 font-bold cursor-pointer"
                      >
                        <Save size={13} />
                        Save Student
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
          {/* Bottom command deck to synchronize transaction */}
          <div className="p-6 md:p-8 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
             <div className="flex items-center gap-2 text-slate-505 text-xs font-semibold">
               <ShieldCheck size={16} className="text-logo-600" />
               Auto-weighted output locks live in the student ledger.
             </div>
             <button 
               onClick={finalizeAllMarks}
               disabled={saving || fetchingStudents || !assessmentMode}
               className="btn btn-primary w-full sm:w-auto flex items-center justify-center gap-2.5 cursor-pointer py-3 px-6 h-[46px]"
             >
                {saving ? (
                  <>
                    <Loader2 className="animate-spin text-white" size={18} />
                    Transactional Sync...
                  </>
                ) : (
                  <>
                    <CheckCircle size={20} />
                    Finalize & Sync Marks Ledger
                  </>
                )}
             </button>
          </div>
        </div>
      )}
    </div>
  );
}
