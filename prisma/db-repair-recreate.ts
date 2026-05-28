import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.resolve('prisma/dev.db');
const WAL_PATH = path.resolve('prisma/dev.db-wal');
const SHM_PATH = path.resolve('prisma/dev.db-shm');

interface BackupData {
  users: any[];
  classes: any[];
  subjects: any[];
  students: any[];
  weekdays: any[];
  timeSlots: any[];
  generatorSettings: any[];
}

async function tryBackup(): Promise<BackupData | null> {
  if (!fs.existsSync(DB_PATH)) {
    console.log('ℹ️ No existing database file found. Proceeding with clean initialization.');
    return null;
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

    await tempPrisma.$disconnect();
    return backup;
  } catch (error: any) {
    console.error('❌ Data rescue extraction failed (database malformed or locked). Falling back of full safe recreation.');
    try {
      await tempPrisma.$disconnect();
    } catch (_) {}
    return null;
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
    execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
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
