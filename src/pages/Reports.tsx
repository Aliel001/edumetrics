import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { getSchoolNameFromId } from "../lib/schoolUtils";
import { toast } from "react-hot-toast";
import {
  FileDown,
  Search,
  GraduationCap,
  Loader2,
  Printer,
  Download,
  AlertCircle,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import CalendarYearPicker from "../components/CalendarYearPicker";

export default function Reports() {
  const { user, academicYear, branding } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [classMarks, setClassMarks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  const [term, setTerm] = useState("Term 1");
  const [year, setYear] = useState(academicYear);

  const [promotions, setPromotions] = useState<Record<string, string>>({});

  const getPromotionStatus = (studentId: string) => {
    return promotions[studentId] || localStorage.getItem(`student_promotion_${studentId}_${term}_${year}`) || "";
  };

  const handlePromotionChange = (studentId: string, status: "Promoted" | "Repeat") => {
    const current = getPromotionStatus(studentId);
    let newStatus = "";
    if (current !== status) {
      newStatus = status;
    }
    
    if (newStatus) {
      localStorage.setItem(`student_promotion_${studentId}_${term}_${year}`, newStatus);
    } else {
      localStorage.removeItem(`student_promotion_${studentId}_${term}_${year}`);
    }

    setPromotions(prev => ({
      ...prev,
      [studentId]: newStatus
    }));

    toast.success(`Updated status to: ${newStatus || "Unspecified"}`);
  };

  useEffect(() => {
    setYear(academicYear);
  }, [academicYear]);

  useEffect(() => {
    api
      .get("/classes")
      .then((res) => setClasses(Array.isArray(res.data) ? res.data : []));
  }, []);

  useEffect(() => {
    if (!selectedClass) {
      setStudents([]);
      setClassMarks([]);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        const [studentsRes, marksRes] = await Promise.all([
          api.get(`/students/by-class/${selectedClass}`),
          api.get(`/marks?classId=${selectedClass}&term=${term}&year=${year}`),
        ]);
        setStudents(Array.isArray(studentsRes.data) ? studentsRes.data : []);
        setClassMarks(Array.isArray(marksRes.data) ? marksRes.data : []);
      } catch (error) {
        toast.error("Failed to load class reports data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedClass, term, year]);

  const generateReport = async (student: any) => {
    if (user?.role !== "admin" && user?.role !== "teacher") {
      toast.error("Only administrators and teachers can generate official reports");
      return;
    }
    const toastId = toast.loading(
      `Generating TVET report for ${student.firstname}...`,
    );
    try {
      // Fetch all assessments for this student for selected term and academicYear
      const assessmentsRes = await api.get(
        `/assessments?studentId=${student.id}&term=${term}&academicYear=${year}`,
      );
      const assessments = Array.isArray(assessmentsRes.data) ? assessmentsRes.data : [];

      if (!assessments || assessments.length === 0) {
        toast.error(
          "No assessment records found for this student for the selected term and year",
          { id: toastId },
        );
        return;
      }

      const doc = new jsPDF();

      // TVET / CBT Professional Report Header
      doc.setFillColor(30, 41, 59); // Slate Dark Theme
      doc.rect(0, 0, 210, 10, "F");

      // Dynamic School Logo & Branding Integration
      let hasLogo = false;
      const logoToUse = branding?.logo_url || "/edumetric.png";
      if (logoToUse) {
        try {
          let format = 'PNG';
          if (logoToUse.includes('image/jpeg') || logoToUse.includes('image/jpg')) {
            format = 'JPEG';
          } else if (logoToUse.includes('image/webp')) {
            format = 'WEBP';
          } else if (logoToUse.includes('image/svg')) {
            format = 'SVG';
          }
          doc.addImage(logoToUse, format, 14, 15, 20, 20);
          hasLogo = true;
        } catch (err) {
          console.error("Could not render logo in PDF report:", err);
        }
      }

      const schoolTitle = getSchoolNameFromId(user?.school_id);

      doc.setFont("Helvetica", "bold");
      doc.setTextColor(30, 41, 59);

      if (hasLogo) {
        doc.setFontSize(16);
        doc.text("TVET / CBT COMPETENCY REPORT", 40, 22);
        
        doc.setFontSize(9);
        doc.setFont("Helvetica", "bold");
        doc.setTextColor(110);
        doc.text(schoolTitle.toUpperCase(), 40, 27);

        doc.setFont("Helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(130);
        doc.text("TECHNICAL & VOCATIONAL EDUCATION TRAINING - ACADEMIC PORTFOLIO", 40, 31);
        doc.text("Official Competency and Performance Evaluation Record", 40, 35);
      } else {
        doc.setFontSize(20);
        doc.text("TVET / CBT COMPETENCY REPORT", 105, 25, { align: "center" });

        doc.setFont("Helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(schoolTitle.toUpperCase(), 105, 31, { align: "center" });

        doc.setFont("Helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(130);
        doc.text("TECHNICAL & VOCATIONAL EDUCATION TRAINING - ACADEMIC PORTFOLIO", 105, 36, { align: "center" });
      }

      // Student Information Section Box
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.rect(14, 44, 182, 38, "FD");

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text("STUDENT PROFILE", 20, 50);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      
      doc.text(`Full Name:`, 20, 58);
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text(`${student.firstname} ${student.lastname}`, 43, 58);

      doc.setFont("Helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(`Student ID:`, 20, 64);
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text(`${student.id.substring(0, 12).toUpperCase()}`, 43, 64);

      doc.setFont("Helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(`Gender:`, 20, 70);
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text(`${student.gender}`, 43, 70);

      doc.setFont("Helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(`Academic Class:`, 110, 58);
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text(`${classes.find((c) => c.id === student.classId)?.className || "TVET Section"}`, 140, 58);

      doc.setFont("Helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(`Academic Year:`, 110, 64);
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text(`${year}`, 140, 64);

      doc.setFont("Helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(`Assessment Term:`, 110, 70);
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text(`${term}`, 140, 70);

      // TVET Assessments Table Data (Do not put current marks or position on report)
      const tableData = assessments.map((m: any) => {
        const fa = m.formativeAssessment ?? 0;
        const ca = m.comprehensiveAssessment ?? 0;
        const pa = m.practicalAssessment ?? 0;
        const sa = m.summativeAssessment ?? 0;
        const total = m.totalMarks ?? (fa + ca + pa + sa);
        const periods = m.periods ?? m.subject?.periodsPerWeek ?? 0;
        const weight = m.subjectWeight ?? m.subject?.subjectWeight ?? 0.0;

        return [
          m.subject?.subjectName || "Unknown Module",
          periods.toString(),
          `${weight.toFixed(1)}%`,
          m.competencyStatus || (total >= 70 ? 'Competent' : 'Not Yet Competent')
        ];
      });

      // Render Table with autoTable
      autoTable(doc, {
        startY: 88,
        head: [
          [
            "Subject / Module",
            "Periods",
            "Weight",
            "Competency Status",
          ],
        ],
        body: tableData,
        theme: "grid",
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: "bold",
          halign: "center",
        },
        columnStyles: {
          0: { cellWidth: 95, fontStyle: "bold" },
          1: { halign: "center" },
          2: { halign: "center" },
          3: { halign: "center", fontStyle: "bold" },
        },
        styles: {
          fontSize: 8,
          cellPadding: 4,
        },
      });

      // Total Summaries with automatic weight calculations
      const totalPeriods = assessments.reduce(
        (acc: number, curr: any) => acc + (curr.periods ?? curr.subject?.periodsPerWeek ?? 0),
        0,
      );
      const totalWeight = assessments.reduce(
        (acc: number, curr: any) => acc + (curr.subjectWeight ?? curr.subject?.subjectWeight ?? 0),
        0,
      );
      const finalWeightedScore = assessments.reduce(
        (acc: number, curr: any) => {
          const t = curr.totalMarks ?? ((curr.formativeAssessment ?? 0) + (curr.comprehensiveAssessment ?? 0) + (curr.practicalAssessment ?? 0) + (curr.summativeAssessment ?? 0));
          const w = curr.subjectWeight ?? curr.subject?.subjectWeight ?? 0;
          return acc + (t * (w / 100));
        },
        0,
      );

      const finalY = (doc as any).lastAutoTable.finalY + 12;

      // Status Indicator Box
      doc.setFillColor(241, 245, 249);
      doc.rect(14, finalY, 182, 26, "F");

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(`PORTFOLIO SUMMARY PERFORMANCE`, 20, finalY + 6);

      doc.setFont("Helvetica", "normal");
      doc.text(`Total Timetable Workload: ${totalPeriods} Periods/Week`, 20, finalY + 14);
      doc.text(`Total Subject Weight Covered: ${totalWeight.toFixed(1)}%`, 20, finalY + 21);

      // Determine average outcome
      const outcomeVal = finalWeightedScore;
      const outcomeStatus = outcomeVal >= 70 ? 'Competent' : 'Not Yet Competent';
      
      doc.setFont("Helvetica", "bold");
      doc.text(`Final Competency Outcome:`, 110, finalY + 11);
      if (outcomeVal >= 70) {
        doc.setTextColor(16, 185, 129);
      } else {
        doc.setTextColor(239, 68, 68);
      }
      doc.text(outcomeStatus.toUpperCase(), 110, finalY + 18);

      // Final Report Decision (Promoted vs Repeat) Section Box (visible on report PDF)
      const decisionY = finalY + 30;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.rect(14, decisionY, 182, 16, "FD");

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text("ACADEMIC YEAR PROMOTION STATUS / DECISION", 20, decisionY + 6);

      // Fetch dynamic student decision state
      const studentDecision = localStorage.getItem(`student_promotion_${student.id}_${term}_${year}`) || "";

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9);

      // Checkbox 1: PROMOTED
      const isPromoted = studentDecision === "Promoted";
      doc.setDrawColor(30, 41, 59);
      doc.rect(20, decisionY + 9, 4, 4, "S");
      if (isPromoted) {
        doc.setFillColor(16, 185, 129); // green
        doc.rect(20.5, decisionY + 9.5, 3, 3, "F");
        doc.setFont("Helvetica", "bold");
        doc.setTextColor(16, 185, 129);
      } else {
        doc.setTextColor(71, 85, 105);
      }
      doc.text("PROMOTED", 26, decisionY + 12);

      // Checkbox 2: REPEAT
      const isRepeat = studentDecision === "Repeat";
      doc.setDrawColor(30, 41, 59);
      doc.rect(80, decisionY + 9, 4, 4, "S");
      if (isRepeat) {
        doc.setFillColor(239, 68, 68); // red
        doc.rect(80.5, decisionY + 9.5, 3, 3, "F");
        doc.setFont("Helvetica", "bold");
        doc.setTextColor(239, 68, 68);
      } else {
        doc.setFont("Helvetica", "normal");
        doc.setTextColor(71, 85, 105);
      }
      doc.text("REPEAT CURRENT GRADE", 86, decisionY + 12);

      // Sign-off section
      const signOffY = decisionY + 28;
      doc.setDrawColor(226, 232, 240);
      doc.line(14, signOffY, 80, signOffY);
      doc.line(120, signOffY, 196, signOffY);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text("Assessor / Lead Teacher Signature", 14, signOffY + 5);
      doc.text("Internal Verifier / Administrator", 120, signOffY + 5);

      // Save PDF
      doc.save(`TVET_CBT_Report_${student.firstname}_${student.lastname}.pdf`);
      toast.success("TVET CBT PDF Generated!", { id: toastId });
    } catch (error) {
      toast.error("Failed to generate report", { id: toastId });
    }
  };

  // Precompute rankings for students based on their accumulated marks
  const studentScores = (students || []).map(st => {
    const stMarks = classMarks.filter((m: any) => m.studentId === st.id);
    const hasMarks = stMarks.length > 0;
    const weightedSum = stMarks.reduce(
      (acc: number, curr: any) => acc + (curr.weightedScore ?? 0),
      0,
    );
    return { id: st.id, score: weightedSum, hasMarks };
  });

  const sortedReady = [...studentScores]
    .filter(item => item.hasMarks)
    .sort((a, b) => b.score - a.score);

  const studentRanks: Record<string, number> = {};
  sortedReady.forEach((item, index) => {
    if (index > 0 && item.score === sortedReady[index - 1].score) {
      studentRanks[item.id] = studentRanks[sortedReady[index - 1].id];
    } else {
      studentRanks[item.id] = index + 1;
    }
  });

  const getOrdinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 sm:p-6 md:p-8 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4 text-left">
            <img 
              src={branding?.logo_url || "/edumetric.png"} 
              alt="School Logo" 
              className="w-12 h-12 sm:w-14 sm:h-14 object-contain rounded-xl border border-slate-100/80 p-1.5 bg-white shadow-xs flex-shrink-0"
              referrerPolicy="no-referrer"
            />
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                Academic Reports
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Generate and download official school reports
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <select
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none bg-slate-50 min-w-[150px] w-full sm:w-auto focus:ring-2 focus:ring-emerald-500/20"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
            >
              <option value="">Select Class</option>
              {Array.isArray(classes) &&
                classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.className}
                  </option>
                ))}
            </select>

            <select
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none bg-slate-50 w-full sm:w-auto focus:ring-2 focus:ring-emerald-500/20"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            >
              <option>Term 1</option>
              <option>Term 2</option>
              <option>Term 3</option>
            </select>

            <div className="w-full sm:w-auto">
              <CalendarYearPicker value={year} onChange={setYear} />
            </div>
          </div>
        </div>
      </div>

      {!selectedClass ? (
        <div className="bg-white p-8 sm:p-12 rounded-2xl border border-slate-100 flex flex-col items-center justify-center text-center">
          <div className="bg-slate-50 p-4 sm:p-6 rounded-full text-slate-400 mb-4">
            <Printer size={40} className="sm:w-12 sm:h-12" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">
            No Class Selected
          </h3>
          <p className="text-slate-500 text-sm max-w-xs mt-2">
            Please select a class from the dropdown above to view students and
            generate reports.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50/80">
            <div className="flex items-center gap-2 px-1 animate-in fade-in flex-wrap">
              <span className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-widest">
                Found {students.length} Students
              </span>
              {selectedClass && (
                <span className="bg-emerald-50 text-emerald-700 text-[10px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-100 uppercase tracking-wide">
                  Class: {classes.find(c => c.id === selectedClass)?.className || "Loading..."}
                </span>
              )}
            </div>
            {(user?.role === "admin" || user?.role === "teacher") && (
              <button
                onClick={async () => {
                  const readyStudents = students.filter(s => classMarks.some(m => m.studentId === s.id));
                  if (readyStudents.length === 0) {
                    toast.error("No students with ready marks to download.");
                    return;
                  }
                  toast.success(`Generating reports for ${readyStudents.length} students...`);
                  for (const s of readyStudents) {
                    await generateReport(s);
                  }
                }}
                className="text-xs sm:text-sm font-bold text-emerald-600 flex items-center gap-1 hover:underline hover:text-emerald-700 transition-colors shrink-0"
              >
                <Download size={16} />
                <span className="inline">Download Bulk Class PDF</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans min-w-[700px]">
              <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-4 sm:px-6 py-4">Student</th>
                  <th className="px-4 sm:px-6 py-4 text-center">Class</th>
                  <th className="px-4 sm:px-6 py-4 text-center">Status</th>
                  <th className="px-4 sm:px-6 py-4 text-center">Portfolio Score (Weighted)</th>
                  <th className="px-4 sm:px-6 py-4 text-center">Class Position</th>
                  <th className="px-4 sm:px-6 py-4 text-center">Decision (Promoted / Repeat)</th>
                  <th className="px-4 sm:px-6 py-4 text-right">Generate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 sm:px-6 py-12 text-center text-slate-400"
                    >
                      <Loader2 className="animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : Array.isArray(students) && students.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 sm:px-6 py-12 text-center text-slate-500"
                    >
                      No students found in this class.
                    </td>
                  </tr>
                ) : (
                  Array.isArray(students) &&
                  students.map((s) => {
                    const studentMarks = classMarks.filter(
                      (m: any) => m.studentId === s.id,
                    );
                    const weightedSum = studentMarks.reduce(
                      (acc: number, curr: any) => acc + (curr.weightedScore ?? 0),
                      0,
                    );
                    const average =
                      studentMarks.length > 0
                        ? weightedSum.toFixed(1) + "%"
                        : "-- %";
                    const isReady = studentMarks.length > 0;
                    const studentClass = classes.find((c) => c.id === s.classId)?.className || "TVET Section";
                    const positionVal = isReady && studentRanks[s.id] ? getOrdinal(studentRanks[s.id]) : "--";

                    return (
                      <React.Fragment key={s.id}>
                        <tr
                           className="hover:bg-slate-50 transition-colors"
                        >
                          <td className="px-4 sm:px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold border border-slate-200 text-sm">
                                {s.firstname.charAt(0)}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 text-sm sm:text-base">
                                  {s.firstname} {s.lastname}
                                </p>
                                <p className="text-[10px] sm:text-xs text-slate-400">
                                  {s.gender}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 sm:px-6 py-4 text-center">
                            <span className="text-xs sm:text-sm font-semibold text-slate-600 bg-slate-100/60 px-2 sm:px-2.5 py-1 rounded-md">
                              {studentClass}
                            </span>
                          </td>
                          <td className="px-4 sm:px-6 py-4 text-center">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold ${
                                isReady
                                  ? "bg-emerald-50 text-emerald-600"
                                  : "bg-amber-50 text-amber-600"
                              }`}
                            >
                              {isReady ? "READY" : "NO MARKS"}
                            </span>
                          </td>
                          <td className="px-4 sm:px-6 py-4 text-center font-bold text-slate-700 text-sm sm:text-base">
                            {average}
                          </td>
                          <td className="px-4 sm:px-6 py-4 text-center font-bold text-slate-700 text-sm sm:text-base">
                            {positionVal}
                          </td>
                          <td className="px-4 sm:px-6 py-4 text-center">
                            {isReady ? (
                              <div className="flex items-center justify-center gap-4">
                                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={getPromotionStatus(s.id) === "Promoted"}
                                    onChange={() => handlePromotionChange(s.id, "Promoted")}
                                    className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500/20 accent-emerald-600"
                                  />
                                  <span className={`text-xs font-bold ${getPromotionStatus(s.id) === "Promoted" ? "text-emerald-700 font-extrabold" : "text-slate-500"}`}>Promoted</span>
                                </label>

                                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={getPromotionStatus(s.id) === "Repeat"}
                                    onChange={() => handlePromotionChange(s.id, "Repeat")}
                                    className="w-4 h-4 text-rose-600 border-slate-300 rounded focus:ring-rose-500/20 accent-rose-600"
                                  />
                                  <span className={`text-xs font-bold ${getPromotionStatus(s.id) === "Repeat" ? "text-rose-700 font-extrabold" : "text-slate-500"}`}>Repeat</span>
                                </label>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic font-semibold">No report available</span>
                            )}
                          </td>
                          <td className="px-4 sm:px-6 py-4 text-right">
                            <div className="flex items-center gap-2 justify-end">
                              <button
                                onClick={() => setExpandedStudentId(expandedStudentId === s.id ? null : s.id)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                  expandedStudentId === s.id
                                    ? "bg-slate-800 text-white border-slate-800 hover:bg-slate-900"
                                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                                  }`}
                              >
                                {expandedStudentId === s.id ? "Hide Marks" : "Preview Marks"}
                              </button>
                              <button
                                onClick={() => generateReport(s)}
                                disabled={(!user || (user.role !== "admin" && user.role !== "teacher")) || !isReady}
                                className={`btn ${(user && (user.role === "admin" || user.role === "teacher")) && isReady ? "bg-slate-100 text-slate-700 hover:bg-emerald-600 hover:text-white" : "bg-slate-50 text-slate-300 cursor-not-allowed"} flex items-center gap-1.5 text-xs sm:text-sm px-3 py-1.5 sm:px-4 sm:py-2`}
                              >
                                <Printer size={14} />
                                Report
                              </button>
                            </div>
                          </td>
                        </tr>
                        
                        {expandedStudentId === s.id && (
                          <tr className="bg-slate-50/50">
                            <td colSpan={7} className="px-4 sm:px-6 py-4">
                              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm max-w-4xl mx-auto">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                                  Recorded Marks List ({term} - {year})
                                </h4>
                                {studentMarks.length === 0 ? (
                                  <p className="text-xs text-slate-400 italic">No recorded marks found for this student.</p>
                                ) : (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs font-sans">
                                      <thead>
                                        <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                                          <th className="py-2">Subject Name</th>
                                          <th className="py-2 text-center">CAT</th>
                                          <th className="py-2 text-center">Exam</th>
                                          <th className="py-2 text-center">Assessments (Formative | Practical | Summative)</th>
                                          <th className="py-2 text-center">Total Score (Weighted)</th>
                                          <th className="py-2 text-center">Grade</th>
                                          <th className="py-2 text-right">Assigned Teacher</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {studentMarks.map((m: any) => (
                                          <tr key={m.id} className="text-slate-700 font-semibold">
                                            <td className="py-2.5 text-slate-900 font-bold">{m.subject?.subjectName || "Subject"}</td>
                                            <td className="py-2.5 text-center font-mono">{m.catMarks ?? 0}</td>
                                            <td className="py-2.5 text-center font-mono">{m.examMarks ?? 0}</td>
                                            <td className="py-2.5 text-center text-[10px] text-slate-550 font-normal">
                                              F: {m.formativeAssessment ?? 0} | P: {m.practicalAssessment ?? 0} | S: {m.summativeAssessment ?? 0}
                                            </td>
                                            <td className="py-2.5 text-center font-bold text-emerald-600 font-mono">
                                              {m.totalMarks ?? 0} ({(m.weightedScore ?? m.totalMarks ?? 0).toFixed(1)}%)
                                            </td>
                                            <td className="py-2.5 text-center font-mono">
                                              <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-slate-800 font-bold">
                                                {m.grade || "F"}
                                              </span>
                                            </td>
                                            <td className="py-2.5 text-right text-[10px] text-slate-500 font-normal">{m.teacher?.fullname || "Unknown"}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <div className="p-6 bg-emerald-50 rounded-xl border border-emerald-100 flex gap-4">
          <AlertCircle className="text-emerald-600 flex-shrink-0" size={24} />
          <div>
            <h4 className="font-bold text-emerald-900">Report Policy</h4>
            <p className="text-sm text-emerald-700 mt-1">
              Reports are generated based on recorded marks. Ensure all teachers
              have finalized their subject marks before generating end-of-term
              reports.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
