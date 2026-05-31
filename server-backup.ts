import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
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
