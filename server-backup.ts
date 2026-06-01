import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

let prismaClient: PrismaClient | null = null;
function getPrisma(): PrismaClient {
  if (!prismaClient) {
    prismaClient = new PrismaClient();
  }
  return prismaClient;
}

const BACKUP_PATH = path.resolve('prisma/backup.json');

let backupTimeout: NodeJS.Timeout | null = null;
let isBackingUp = false;

/**
 * Perform a full backup of all tables directly to a JSON file in the persistent workspace.
 */
export async function autoBackupDatabase() {
  if (isBackingUp) return;
  isBackingUp = true;
  try {
    const prisma = getPrisma();
    const backupData = {
      users: await prisma.user.findMany(),
      classes: await prisma.class.findMany(),
      subjects: await prisma.subject.findMany(),
      students: await prisma.student.findMany(),
      weekdays: await prisma.weekday.findMany(),
      timeSlots: await prisma.timeSlot.findMany(),
      generatorSettings: await prisma.generatorSettings.findMany(),
      schoolBranding: await prisma.schoolBranding.findMany(),
      teacherAssignment: await prisma.teacherAssignment.findMany(),
      timetable: await prisma.timetable.findMany(),
      mark: await prisma.mark.findMany(),
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync(BACKUP_PATH, JSON.stringify(backupData, null, 2), 'utf-8');
    console.log(`💾 Auto database backup written to JSON successfully (Saved ${backupData.users.length} users, ${backupData.students.length} students).`);
  } catch (err: any) {
    console.warn('⚠️ Auto database backup execution failed:', err.message || err);
  } finally {
    isBackingUp = false;
  }
}

/**
 * Debounce backup triggers to prevent heavy disk I/O on immediate sequential writes.
 */
export function triggerBackup() {
  if (backupTimeout) {
    clearTimeout(backupTimeout);
  }
  backupTimeout = setTimeout(async () => {
    await autoBackupDatabase();
  }, 1500);
}

/**
 * Restore database records from persistent backup.json file on startup.
 */
export async function restoreBackupFromJSON(prisma: PrismaClient): Promise<boolean> {
  const possibleBackupPaths = [
    path.resolve('prisma/backup.json'),
    path.join(process.cwd(), 'prisma', 'backup.json'),
  ];
  
  let backupPath: string | null = null;
  for (const p of possibleBackupPaths) {
    if (fs.existsSync(p)) {
      backupPath = p;
      break;
    }
  }
  
  if (!backupPath) {
    console.log('ℹ️ No persistent JSON database backup found to restore on startup.');
    return false;
  }
  
  try {
    const content = fs.readFileSync(backupPath, 'utf8');
    const backup = JSON.parse(content);
    console.log(`💾 Found backup JSON file containing ${backup.users?.length || 0} users and ${backup.students?.length || 0} students. Starting non-destructive database restoration...`);
    
    // 1. Weekdays
    if (backup.weekdays && Array.isArray(backup.weekdays)) {
      for (const wd of backup.weekdays) {
        await prisma.weekday.upsert({
          where: { id: wd.id },
          update: { dayName: wd.dayName },
          create: { id: wd.id, dayName: wd.dayName }
        });
      }
    }
    
    // 2. TimeSlots
    if (backup.timeSlots && Array.isArray(backup.timeSlots)) {
      for (const ts of backup.timeSlots) {
        await prisma.timeSlot.upsert({
          where: { id: ts.id },
          update: { startTime: ts.startTime, endTime: ts.endTime, slotType: ts.slotType },
          create: { id: ts.id, startTime: ts.startTime, endTime: ts.endTime, slotType: ts.slotType }
        });
      }
    }
    
    // 3. GeneratorSettings
    if (backup.generatorSettings && Array.isArray(backup.generatorSettings)) {
      for (const gs of backup.generatorSettings) {
        await prisma.generatorSettings.upsert({
          where: { id: gs.id },
          update: { periodsPerDay: gs.periodsPerDay, breakStartTime: gs.breakStartTime, breakDuration: gs.breakDuration, lunchStartTime: gs.lunchStartTime, lunchDuration: gs.lunchDuration },
          create: { id: gs.id, periodsPerDay: gs.periodsPerDay, breakStartTime: gs.breakStartTime, breakDuration: gs.breakDuration, lunchStartTime: gs.lunchStartTime, lunchDuration: gs.lunchDuration }
        });
      }
    }
    
    // 4. Users
    if (backup.users && Array.isArray(backup.users)) {
      for (const u of backup.users) {
        await prisma.user.upsert({
          where: { id: u.id },
          update: { fullname: u.fullname, email: u.email, password: u.password, phone: u.phone, role: u.role, school_id: u.school_id, isVerified: u.isVerified, createdAt: u.createdAt ? new Date(u.createdAt) : undefined },
          create: { id: u.id, fullname: u.fullname, email: u.email, password: u.password, phone: u.phone, role: u.role, school_id: u.school_id, isVerified: u.isVerified, createdAt: u.createdAt ? new Date(u.createdAt) : undefined }
        });
      }
    }
    
    // 5. Classes
    if (backup.classes && Array.isArray(backup.classes)) {
      for (const c of backup.classes) {
        await prisma.class.upsert({
          where: { id: c.id },
          update: { className: c.className, school_id: c.school_id },
          create: { id: c.id, className: c.className, school_id: c.school_id }
        });
      }
    }
    
    // 6. Subjects
    if (backup.subjects && Array.isArray(backup.subjects)) {
      for (const s of backup.subjects) {
        await prisma.subject.upsert({
          where: { id: s.id },
          update: { subjectName: s.subjectName, periodsPerWeek: s.periodsPerWeek, subjectWeight: s.subjectWeight, school_id: s.school_id },
          create: { id: s.id, subjectName: s.subjectName, periodsPerWeek: s.periodsPerWeek, subjectWeight: s.subjectWeight, school_id: s.school_id }
        });
      }
    }
    
    // 7. Students
    if (backup.students && Array.isArray(backup.students)) {
      for (const st of backup.students) {
        await prisma.student.upsert({
          where: { id: st.id },
          update: { firstname: st.firstname, lastname: st.lastname, gender: st.gender, classId: st.classId, school_id: st.school_id, createdAt: st.createdAt ? new Date(st.createdAt) : undefined },
          create: { id: st.id, firstname: st.firstname, lastname: st.lastname, gender: st.gender, classId: st.classId, school_id: st.school_id, createdAt: st.createdAt ? new Date(st.createdAt) : undefined }
        });
      }
    }
    
    // 8. TeacherAssignments
    if (backup.teacherAssignment && Array.isArray(backup.teacherAssignment)) {
      for (const ta of backup.teacherAssignment) {
        await prisma.teacherAssignment.upsert({
          where: { id: ta.id },
          update: { teacherId: ta.teacherId, classId: ta.classId, subjectId: ta.subjectId, periodsPerWeek: ta.periodsPerWeek },
          create: { id: ta.id, teacherId: ta.teacherId, classId: ta.classId, subjectId: ta.subjectId, periodsPerWeek: ta.periodsPerWeek }
        });
      }
    }
    
    // 9. SchoolBranding
    if (backup.schoolBranding && Array.isArray(backup.schoolBranding)) {
      for (const sb of backup.schoolBranding) {
        await prisma.schoolBranding.upsert({
          where: { school_id: sb.school_id },
          update: { logo_url: sb.logo_url, primary_color: sb.primary_color },
          create: { school_id: sb.school_id, logo_url: sb.logo_url, primary_color: sb.primary_color }
        });
      }
    }
    
    // 10. Timetables
    if (backup.timetable && Array.isArray(backup.timetable)) {
      for (const tt of backup.timetable) {
        await prisma.timetable.upsert({
          where: { id: tt.id },
          update: { classId: tt.classId, subjectId: tt.subjectId, teacherId: tt.teacherId, timeSlotId: tt.timeSlotId, weekdayId: tt.weekdayId, createdAt: tt.createdAt ? new Date(tt.createdAt) : undefined },
          create: { id: tt.id, classId: tt.classId, subjectId: tt.subjectId, teacherId: tt.teacherId, timeSlotId: tt.timeSlotId, weekdayId: tt.weekdayId, createdAt: tt.createdAt ? new Date(tt.createdAt) : undefined }
        });
      }
    }
    
    // 11. Marks
    if (backup.mark && Array.isArray(backup.mark)) {
      for (const mk of backup.mark) {
        await prisma.mark.upsert({
          where: { id: mk.id },
          update: {
            studentId: mk.studentId,
            subjectId: mk.subjectId,
            teacherId: mk.teacherId,
            catMarks: mk.catMarks,
            examMarks: mk.examMarks,
            formativeAssessment: mk.formativeAssessment,
            comprehensiveAssessment: mk.comprehensiveAssessment,
            practicalAssessment: mk.practicalAssessment,
            summativeAssessment: mk.summativeAssessment,
            totalMarks: mk.totalMarks,
            averageMarks: mk.averageMarks,
            competencyStatus: mk.competencyStatus,
            grade: mk.grade,
            term: mk.term,
            year: mk.year,
            academicYear: mk.academicYear,
            school_id: mk.school_id,
            createdAt: mk.createdAt ? new Date(mk.createdAt) : undefined
          },
          create: {
            id: mk.id,
            studentId: mk.studentId,
            subjectId: mk.subjectId,
            teacherId: mk.teacherId,
            catMarks: mk.catMarks,
            examMarks: mk.examMarks,
            formativeAssessment: mk.formativeAssessment,
            comprehensiveAssessment: mk.comprehensiveAssessment,
            practicalAssessment: mk.practicalAssessment,
            summativeAssessment: mk.summativeAssessment,
            totalMarks: mk.totalMarks,
            averageMarks: mk.averageMarks,
            competencyStatus: mk.competencyStatus,
            grade: mk.grade,
            term: mk.term,
            year: mk.year,
            academicYear: mk.academicYear,
            school_id: mk.school_id,
            createdAt: mk.createdAt ? new Date(mk.createdAt) : undefined
          }
        });
      }
    }
    
    console.log('✅ Non-destructive database restoration from backup.json completed successfully on startup.');
    return true;
  } catch (err: any) {
    console.error('❌ Failed to restore database from backup.json on startup:', err.message || err);
    return false;
  }
}
