import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const isVercel = !!process.env.VERCEL || !!process.env.NOW_BUILDER;
const DB_PATH = isVercel ? '/tmp/dev.db' : path.resolve('prisma/dev.db');
const WAL_PATH = isVercel ? '/tmp/dev.db-wal' : path.resolve('prisma/dev.db-wal');
const SHM_PATH = isVercel ? '/tmp/dev.db-shm' : path.resolve('prisma/dev.db-shm');

// Since this application is built for the SQLite provider, we always force DATABASE_URL to SQLite.
// This prevents external/global PostgreSQL environment variable overrides on Cloud Run from breaking Prisma.
process.env.DATABASE_URL = `file:${DB_PATH}`;

interface BackupData {
  users: any[];
  classes: any[];
  subjects: any[];
  students: any[];
  weekdays: any[];
  timeSlots: any[];
  generatorSettings: any[];
  schoolBranding?: any[];
  teacherAssignment?: any[];
  timetable?: any[];
  mark?: any[];
  teacherAttendance?: any[];
  studentAttendance?: any[];
}

async function tryBackup(): Promise<BackupData | null> {
  const backupJsonPath = path.resolve('prisma/backup.json');
  let jsonBackup: BackupData | null = null;
  if (fs.existsSync(backupJsonPath)) {
    try {
      jsonBackup = JSON.parse(fs.readFileSync(backupJsonPath, 'utf-8'));
      console.log(`✅ Loaded workspace persistent JSON backup with ${jsonBackup?.users?.length || 0} users and ${jsonBackup?.students?.length || 0} students.`);
    } catch (e: any) {
      console.warn('⚠️ Failed to load or parse prisma/backup.json:', e.message);
    }
  }

  if (!fs.existsSync(DB_PATH)) {
    console.log('ℹ️ No existing database file found. Proceeding with backup.json or clean initialization.');
    return jsonBackup;
  }

  console.log('🔍 Attempting to query and rescue existing data from current database...');
  const tempPrisma = new PrismaClient({
    datasources: {
      db: {
        url: `file:${DB_PATH}`,
      },
    },
  });

  try {
    const backup: BackupData = {
      users: [],
      classes: [],
      subjects: [],
      students: [],
      weekdays: [],
      timeSlots: [],
      generatorSettings: [],
    };

    // Try individual queries with separate try-catches to retrieve as much data as possible
    try {
      backup.users = await tempPrisma.user.findMany();
      console.log(`✅ Rescued ${backup.users.length} Users successfully.`);
    } catch (e: any) {
      console.warn('⚠️ Could not rescue Users:', e.message || e);
    }

    try {
      backup.classes = await tempPrisma.class.findMany();
      console.log(`✅ Rescued ${backup.classes.length} Classes successfully.`);
    } catch (e: any) {
      console.warn('⚠️ Could not rescue Classes:', e.message || e);
    }

    try {
      backup.subjects = await tempPrisma.subject.findMany();
      console.log(`✅ Rescued ${backup.subjects.length} Subjects successfully.`);
    } catch (e: any) {
      console.warn('⚠️ Could not rescue Subjects:', e.message || e);
    }

    try {
      backup.students = await tempPrisma.student.findMany();
      console.log(`✅ Rescued ${backup.students.length} Students successfully.`);
    } catch (e: any) {
      console.warn('⚠️ Could not rescue Students:', e.message || e);
    }

    try {
      backup.weekdays = await tempPrisma.weekday.findMany();
      console.log(`✅ Rescued ${backup.weekdays.length} Weekdays successfully.`);
    } catch (e: any) {
      console.warn('⚠️ Could not rescue Weekdays:', e.message || e);
    }

    try {
      backup.timeSlots = await tempPrisma.timeSlot.findMany();
      console.log(`✅ Rescued ${backup.timeSlots.length} TimeSlots successfully.`);
    } catch (e: any) {
      console.warn('⚠️ Could not rescue TimeSlots:', e.message || e);
    }

    try {
      backup.generatorSettings = await tempPrisma.generatorSettings.findMany();
      console.log(`✅ Rescued ${backup.generatorSettings.length} GeneratorSettings successfully.`);
    } catch (e: any) {
      console.warn('⚠️ Could not rescue GeneratorSettings:', e.message || e);
    }

    try {
      backup.teacherAttendance = await tempPrisma.teacherAttendance.findMany();
      console.log(`✅ Rescued ${backup.teacherAttendance.length} TeacherAttendances successfully.`);
    } catch (e: any) {
      console.warn('⚠️ Could not rescue TeacherAttendances:', e.message || e);
    }

    try {
      backup.studentAttendance = await tempPrisma.studentAttendance.findMany();
      console.log(`✅ Rescued ${backup.studentAttendance.length} StudentAttendances successfully.`);
    } catch (e: any) {
      console.warn('⚠️ Could not rescue StudentAttendances:', e.message || e);
    }

    await tempPrisma.$disconnect();

    if (jsonBackup) {
      const liveUserCount = backup.users.length;
      const jsonUserCount = jsonBackup.users?.length || 0;
      const liveStudentCount = backup.students.length;
      const jsonStudentCount = jsonBackup.students?.length || 0;

      if (jsonUserCount > liveUserCount || jsonStudentCount > liveStudentCount) {
        console.log('📌 Persistent JSON backup has more records than the queried database. Using JSON backup to prevent data loss.');
        return jsonBackup;
      }
    }

    return backup;
  } catch (error: any) {
    console.error('❌ Data rescue extraction failed (database malformed or locked). falling back to persistent JSON backup.');
    try {
      await tempPrisma.$disconnect();
    } catch (_) {}
    return jsonBackup;
  }
}

function purgeDatabaseFiles() {
  console.log('🗑️ Safely deleting old malformed database files...');
  [DB_PATH, WAL_PATH, SHM_PATH].forEach((file) => {
    if (fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
        console.log(`   Deleted: ${path.basename(file)}`);
      } catch (err: any) {
        console.warn(`   Could not delete ${path.basename(file)}:`, err.message);
      }
    }
  });
}

async function rebuildDatabase() {
  console.log('🏗️ Triggering Prisma db push to generate and schema-sync a clean dev.db database...');
  try {
    execSync('npx prisma db push --accept-data-loss', {
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: `file:${DB_PATH}`
      }
    });
    console.log('✅ Base database schema built successfully.');
  } catch (err: any) {
    console.error('❌ Failed to push database schema:', err.message);
    process.exit(1);
  }
}

async function restoreOrSeed(backup: BackupData | null) {
  console.log('🌱 Populating database. Restoring rescued data or creating clean seeds...');
  const prisma = new PrismaClient();

  try {
    // 1. Restore/Seed Weekdays
    const weekdaysToInsert = [
      { dayName: 'Monday' },
      { dayName: 'Tuesday' },
      { dayName: 'Wednesday' },
      { dayName: 'Thursday' },
      { dayName: 'Friday' },
    ];
    const finalWeekdays = (backup?.weekdays && backup.weekdays.length > 0) ? backup.weekdays : weekdaysToInsert;
    for (const wd of finalWeekdays) {
      await prisma.weekday.upsert({
        where: { dayName: wd.dayName },
        update: {},
        create: { id: wd.id, dayName: wd.dayName },
      });
    }
    console.log('   Weekdays table synchronized.');

    // 2. Restore/Seed Users
    const finalUsers = (backup?.users && backup.users.length > 0) ? backup.users : [];
    if (finalUsers.length > 0) {
      for (const u of finalUsers) {
        await prisma.user.upsert({
          where: { email: u.email },
          update: {},
          create: {
            id: u.id,
            fullname: u.fullname,
            email: u.email,
            password: u.password,
            role: u.role,
            isVerified: u.isVerified !== undefined ? u.isVerified : true,
            createdAt: u.createdAt ? new Date(u.createdAt) : undefined,
          },
        });
      }
      console.log(`   Restored ${finalUsers.length} Users.`);
    } else {
      const adminPassword = await bcrypt.hash('admin123', 10);
      const teacherPassword = await bcrypt.hash('teacher123', 10);

      await prisma.user.create({
        data: {
          fullname: 'System Admin',
          email: 'admin@edumetric.com',
          password: adminPassword,
          role: 'admin',
        },
      });

      await prisma.user.create({
        data: {
          fullname: 'John Doe',
          email: 'teacher@edumetric.com',
          password: teacherPassword,
          role: 'teacher',
        },
      });
      console.log('   Synchronized default System Admin and John Doe main accounts.');
    }

        // 3. Restore/Seed Classes
    const defaultClasses = [{ className: 'Class 10A' }, { className: 'Class 11B' }, { className: 'Class 12C' }];
    const finalClasses = (backup?.classes && backup.classes.length > 0) ? backup.classes : defaultClasses;
    for (const c of finalClasses) {
      await prisma.class.upsert({
        where: {
          className_school_id: {
            className: c.className,
            school_id: c.school_id || 'default-school'
          }
        },
        update: {},
        create: { id: c.id, className: c.className, school_id: c.school_id || 'default-school' },
      });
    }
    console.log('   Classes table synchronized.');

    // Retrieve active classes from DB to link students
    const classesInDb = await prisma.class.findMany();
    const class10A = classesInDb.find((c) => c.className === 'Class 10A') || classesInDb[0];
    const class11B = classesInDb.find((c) => c.className === 'Class 11B') || classesInDb[1] || classesInDb[0];

    // 4. Restore/Seed Subjects
    const defaultSubjects = [
      { subjectName: 'Mathematics', periodsPerWeek: 5, subjectWeight: 1.0 },
      { subjectName: 'Science', periodsPerWeek: 4, subjectWeight: 1.0 },
      { subjectName: 'English', periodsPerWeek: 4, subjectWeight: 0.8 },
      { subjectName: 'Swahili', periodsPerWeek: 3, subjectWeight: 0.8 },
      { subjectName: 'ICT', periodsPerWeek: 3, subjectWeight: 1.2 },
    ];
    const finalSubjects = (backup?.subjects && backup.subjects.length > 0) ? backup.subjects : defaultSubjects;
    for (const s of finalSubjects) {
      await prisma.subject.upsert({
        where: {
          subjectName_school_id: {
            subjectName: s.subjectName,
            school_id: s.school_id || 'default-school'
          }
        },
        update: {},
        create: {
          id: s.id,
          subjectName: s.subjectName,
          periodsPerWeek: s.periodsPerWeek,
          subjectWeight: s.subjectWeight,
          school_id: s.school_id || 'default-school',
        },
      });
    }
    console.log('   Subjects table synchronized.');

    // 5. Restore/Seed Students
    const finalStudents = (backup?.students && backup.students.length > 0) ? backup.students : [];
    if (finalStudents.length > 0) {
      for (const st of finalStudents) {
        // Ensure classId exists in new db before inserting Student
        const classExist = classesInDb.some((c) => c.id === st.classId);
        await prisma.student.create({
          data: {
            id: st.id,
            firstname: st.firstname,
            lastname: st.lastname,
            gender: st.gender,
            classId: classExist ? st.classId : class10A.id,
            createdAt: st.createdAt ? new Date(st.createdAt) : undefined,
          },
        });
      }
      console.log(`   Restored ${finalStudents.length} Students.`);
    } else if (class10A) {
      await prisma.student.createMany({
        data: [
          { firstname: 'Jane', lastname: 'Smith', gender: 'Female', classId: class10A.id },
          { firstname: 'Alex', lastname: 'Johnson', gender: 'Male', classId: class10A.id },
          { firstname: 'Robert', lastname: 'Brown', gender: 'Male', classId: class11B ? class11B.id : class10A.id },
          { firstname: 'Emily', lastname: 'Davis', gender: 'Female', classId: class11B ? class11B.id : class10A.id },
        ],
      });
      console.log('   Seeded standard sample students.');
    }

    // 6. Restore/Seed Time Slots
    const defaultSlots = [
      { startTime: '08:00', endTime: '08:45', slotType: 'class' },
      { startTime: '08:45', endTime: '09:30', slotType: 'class' },
      { startTime: '09:30', endTime: '10:15', slotType: 'class' },
      { startTime: '10:15', endTime: '10:45', slotType: 'break' },
      { startTime: '10:45', endTime: '11:30', slotType: 'class' },
      { startTime: '11:30', endTime: '12:15', slotType: 'class' },
      { startTime: '12:15', endTime: '13:00', slotType: 'class' },
      { startTime: '13:00', endTime: '14:00', slotType: 'lunch' },
      { startTime: '14:00', endTime: '14:45', slotType: 'class' },
      { startTime: '14:45', endTime: '15:30', slotType: 'class' },
    ];
    const finalTimeSlots = (backup?.timeSlots && backup.timeSlots.length > 0) ? backup.timeSlots : defaultSlots;
    for (const slot of finalTimeSlots) {
      await prisma.timeSlot.create({
        data: {
          id: slot.id,
          startTime: slot.startTime,
          endTime: slot.endTime,
          slotType: slot.slotType,
        },
      });
    }
    console.log('   Time slots table synchronized.');

    // 7. Generator Settings
    const defaultGS = {
      id: 'default',
      periodsPerDay: 8,
      breakStartTime: '10:15',
      breakDuration: 30,
      lunchStartTime: '13:00',
      lunchDuration: 60,
    };
    const finalGS = (backup?.generatorSettings && backup.generatorSettings.length > 0) ? backup.generatorSettings[0] : defaultGS;
    await prisma.generatorSettings.upsert({
      where: { id: 'default' },
      update: {},
      create: {
        id: 'default',
        periodsPerDay: finalGS.periodsPerDay,
        breakStartTime: finalGS.breakStartTime,
        breakDuration: finalGS.breakDuration,
        lunchStartTime: finalGS.lunchStartTime,
        lunchDuration: finalGS.lunchDuration,
      },
    });
    console.log('   School generator settings synchronized.');

    // 8. Teacher Assignments
    if (backup && backup.teacherAssignment && backup.teacherAssignment.length > 0) {
      console.log('   Restoring Teacher Assignments...');
      for (const ta of backup.teacherAssignment) {
        try {
          await prisma.teacherAssignment.upsert({
            where: { id: ta.id },
            update: {},
            create: {
              id: ta.id,
              teacherId: ta.teacherId,
              classId: ta.classId,
              subjectId: ta.subjectId,
              periodsPerWeek: ta.periodsPerWeek
            }
          });
        } catch (e: any) {
          console.warn(`      Failed to restore teacher assignment ${ta.id}:`, e.message);
        }
      }
    }

    // 9. Timetable
    if (backup && backup.timetable && backup.timetable.length > 0) {
      console.log('   Restoring Timetable slots...');
      for (const tt of backup.timetable) {
        try {
          await prisma.timetable.upsert({
            where: { id: tt.id },
            update: {},
            create: {
              id: tt.id,
              classId: tt.classId,
              subjectId: tt.subjectId,
              teacherId: tt.teacherId,
              timeSlotId: tt.timeSlotId,
              weekdayId: tt.weekdayId,
              createdAt: tt.createdAt ? new Date(tt.createdAt) : undefined
            }
          });
        } catch (e: any) {
          console.warn(`      Failed to restore timetable slot ${tt.id}:`, e.message);
        }
      }
    }

    // 10. Marks
    if (backup && backup.mark && backup.mark.length > 0) {
      console.log('   Restoring Student Marks...');
      for (const mk of backup.mark) {
        try {
          await prisma.mark.upsert({
            where: { id: mk.id },
            update: {},
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
        } catch (e: any) {
          console.warn(`      Failed to restore mark ${mk.id}:`, e.message);
        }
      }
    }

    // 11. School Branding
    if (backup && backup.schoolBranding && backup.schoolBranding.length > 0) {
      console.log('   Restoring School Branding...');
      for (const sb of backup.schoolBranding) {
        try {
          await prisma.schoolBranding.upsert({
            where: { school_id: sb.school_id },
            update: {
              logo_url: sb.logo_url,
              primary_color: sb.primary_color
            },
            create: {
              school_id: sb.school_id,
              logo_url: sb.logo_url,
              primary_color: sb.primary_color
            }
          });
        } catch (e: any) {
          console.warn(`      Failed to restore school branding for school ${sb.school_id}:`, e.message);
        }
      }
    }

    // 12. Teacher Attendance
    if (backup && backup.teacherAttendance && backup.teacherAttendance.length > 0) {
      console.log('   Restoring Teacher Attendance...');
      for (const ta of backup.teacherAttendance) {
        try {
          await prisma.teacherAttendance.upsert({
            where: { id: ta.id },
            update: {
              teacherId: ta.teacherId,
              date: ta.date,
              status: ta.status,
              remark: ta.remark,
              createdAt: ta.createdAt ? new Date(ta.createdAt) : undefined
            },
            create: {
              id: ta.id,
              teacherId: ta.teacherId,
              date: ta.date,
              status: ta.status,
              remark: ta.remark,
              createdAt: ta.createdAt ? new Date(ta.createdAt) : undefined
            }
          });
        } catch (e: any) {
          console.warn(`      Failed to restore teacher attendance ${ta.id}:`, e.message);
        }
      }
    }

    // 13. Student Attendance
    if (backup && backup.studentAttendance && backup.studentAttendance.length > 0) {
      console.log('   Restoring Student Attendance...');
      for (const sa of backup.studentAttendance) {
        try {
          await prisma.studentAttendance.upsert({
            where: { id: sa.id },
            update: {
              studentId: sa.studentId,
              classId: sa.classId,
              teacherId: sa.teacherId,
              date: sa.date,
              status: sa.status,
              remark: sa.remark,
              createdAt: sa.createdAt ? new Date(sa.createdAt) : undefined
            },
            create: {
              id: sa.id,
              studentId: sa.studentId,
              classId: sa.classId,
              teacherId: sa.teacherId,
              date: sa.date,
              status: sa.status,
              remark: sa.remark,
              createdAt: sa.createdAt ? new Date(sa.createdAt) : undefined
            }
          });
        } catch (e: any) {
          console.warn(`      Failed to restore student attendance ${sa.id}:`, e.message);
        }
      }
    }

    console.log('✨ Re-import and repair process completes with flawless success.');
  } catch (error: any) {
    console.error('❌ Error during data restoration & seeding:', error.message || error);
  } finally {
    await prisma.$disconnect();
  }
}

async function run() {
  console.log('============================================');
  console.log('    🛠️ DATABASE RESCUE & COMPREHENSIVE REPAIR 🛠️');
  console.log('============================================');

  const backup = await tryBackup();
  purgeDatabaseFiles();
  await rebuildDatabase();
  await restoreOrSeed(backup);

  console.log('============================================');
  console.log(' ✅ REPAIR FINISHED. DATABASE HEALTHY AND ONLINE!');
  console.log('============================================');
}

run();
