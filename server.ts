import dotenv from 'dotenv';
const envConfig = dotenv.config();
if (envConfig.parsed) {
  // Force override system env vars with .env file values
  Object.assign(process.env, envConfig.parsed);
}

import path from 'path';
import fs from 'fs';

// Dynamic SQLite database setup to handle read-only hosting platforms like Vercel Serverless
// We set process.env.DATABASE_URL immediately, so ANY module dynamically importing or creating PrismaClient
// inherits this configuration and accesses the writable /tmp directory.
if (!process.env.DATABASE_URL) {
  const isVercel = !!process.env.VERCEL || !!process.env.NOW_BUILDER;
  if (isVercel) {
    const srcDb = path.join(process.cwd(), 'prisma', 'dev.db');
    const tmpDb = path.join('/tmp', 'dev.db');
    try {
      if (fs.existsSync(srcDb)) {
        if (!fs.existsSync(tmpDb)) {
          fs.copyFileSync(srcDb, tmpDb);
          console.log('Database successfully copied to writable /tmp/dev.db location for Serverless environments.');
        } else {
          console.log('Using existing /tmp/dev.db database file.');
        }
      } else {
        console.warn('Source database dev.db not found at:', srcDb);
      }
    } catch (err) {
      console.error('Error copying dev.db to /tmp:', err);
    }
    process.env.DATABASE_URL = `file:${tmpDb}`;
  } else {
    process.env.DATABASE_URL = `file:${path.resolve('prisma/dev.db')}`;
  }
}

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import express, { Request, Response, NextFunction } from 'express';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import { sendTeacherInviteEmail, sendTeacherCredentialsEmail } from './server-mailer';
import { triggerBackup } from './server-backup';

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

const JWT_SECRET = process.env.JWT_SECRET || 'edumetric-secret-key-2024';

function getSchoolNameFromId(schoolId: string): string {
  if (!schoolId || schoolId === 'default-school') return 'EduMetric School';
  // Remove trailing random 4-digit number
  let namePart = schoolId.replace(/-\d{4}$/, '');
  // Capitalize each part
  return namePart
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

let isRepairing = false;

async function runDatabaseRepair() {
  if (isRepairing) {
    console.log('⚠️ Database repair is already in progress, skipping concurrent run.');
    return;
  }
  isRepairing = true;
  try {
    console.log('🔄 Triggering automated database recovery...');
    execSync('npx tsx prisma/db-repair-recreate.ts', { stdio: 'inherit' });
    console.log('✅ Automated database recovery completed!');
  } catch (err: any) {
    console.error('❌ Database repair execution failed:', err.message || err);
  } finally {
    isRepairing = false;
  }
}

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cors());

// Maintenance/repair block middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  if (isRepairing) {
    res.status(503).json({
      error: 'Database is currently undergoing automated recovery/repair. Please retry in a few seconds.',
      retry: true
    });
    return;
  }
  next();
});

// Auto-backup on successful mutations (POST, PUT, DELETE)
app.use((req: Request, res: Response, next: NextFunction) => {
  res.on('finish', () => {
    if (['POST', 'PUT', 'DELETE'].includes(req.method) && res.statusCode >= 200 && res.statusCode < 350) {
      triggerBackup();
    }
  });
  next();
});

// --- UTILS ---

const calculateGrade = (total: number) => {
  if (total >= 80) return 'A';
  if (total >= 70) return 'B';
  if (total >= 60) return 'C';
  if (total >= 50) return 'D';
  return 'F';
};

async function recalculateSubjectWeights() {
  try {
    console.log('Recalculating automatic subject weights from timetable...');
    const entries = await prisma.timetable.findMany();
    const subjects = await prisma.subject.findMany();

    if (entries.length === 0) {
      for (const sub of subjects) {
        await prisma.subject.update({
          where: { id: sub.id },
          data: { periodsPerWeek: 0, subjectWeight: 0.0 }
        });
      }
      return;
    }

    // Total subject slots
    const totalSlots = entries.filter(e => e.subjectId).length;

    for (const sub of subjects) {
      const subEntries = entries.filter(e => e.subjectId === sub.id);
      const periods = subEntries.length;
      
      // Calculate dynamic periods per week (average across classes taught)
      const uniqueClasses = new Set(subEntries.map(e => e.classId));
      const classCount = uniqueClasses.size || 1;
      const avgPeriodsPerWeek = Math.round(periods / classCount);

      const weight = totalSlots > 0 ? (periods / totalSlots) * 100 : 0;

      await prisma.subject.update({
        where: { id: sub.id },
        data: {
          periodsPerWeek: avgPeriodsPerWeek,
          subjectWeight: Math.round(weight * 10) / 10
        }
      });
    }
    console.log('Subject weights successfully updated in the database.');
  } catch (error) {
    console.error('Error in recalculateSubjectWeights:', error);
  }
}

async function getClassSubjectWeights(classId: string) {
  try {
    const entries = await prisma.timetable.findMany({
      where: { classId }
    });

    const classSlots = entries.filter(e => e.subjectId);
    const totalPeriods = classSlots.length;
    const subjects = await prisma.subject.findMany();

    const result: Record<string, { periods: number; weight: number }> = {};

    if (totalPeriods === 0) {
      // Fallback to global stored subject weights
      subjects.forEach(sub => {
        result[sub.id] = {
          periods: sub.periodsPerWeek || 0,
          weight: sub.subjectWeight || 0.0
        };
      });
      return result;
    }

    subjects.forEach(sub => {
      const subEntries = classSlots.filter(e => e.subjectId === sub.id);
      const periods = subEntries.length;
      const weight = totalPeriods > 0 ? (periods / totalPeriods) * 100 : 0;
      result[sub.id] = {
        periods,
        weight: Math.round(weight * 10) / 10
      };
    });

    return result;
  } catch (error) {
    console.error(`Error in getClassSubjectWeights for class ${classId}:`, error);
    return {};
  }
}

async function enrichMarksWithWeights(marks: any[]) {
  const enriched = [];
  const classIds = Array.from(new Set(marks.map(m => m.student?.classId).filter(Boolean))) as string[];
  const classWeightsMap: Record<string, Record<string, { periods: number; weight: number }>> = {};
  
  for (const cid of classIds) {
    classWeightsMap[cid] = await getClassSubjectWeights(cid);
  }

  for (const m of marks) {
    const classId = m.student?.classId;
    let periods = m.subject?.periodsPerWeek || 0;
    let weight = m.subject?.subjectWeight || 0.0;

    if (classId && classWeightsMap[classId] && classWeightsMap[classId][m.subjectId]) {
      periods = classWeightsMap[classId][m.subjectId].periods;
      weight = classWeightsMap[classId][m.subjectId].weight;
    }

    const total = m.totalMarks || (m.formativeAssessment + m.comprehensiveAssessment + m.practicalAssessment + m.summativeAssessment || 0);
    const weightedScore = Math.round((total * (weight / 100)) * 10) / 10;

    enriched.push({
      ...m,
      periods,
      subjectWeight: weight,
      weightedScore
    });
  }
  return enriched;
}

// --- MIDDLEWARE ---

const authenticateToken = (req: any, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Access denied' });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user ? { ...user, school_id: user.school_id || 'default-school' } : user;
    next();
  });
};

const isAdmin = (req: any, res: Response, next: NextFunction) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

const isDosOrAdmin = (req: any, res: Response, next: NextFunction) => {
  if (req.user.role !== 'dos' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'DOS or Admin access required' });
  }
  next();
};

const isTeacher = (req: any, res: Response, next: NextFunction) => {
  if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Teacher access required' });
  }
  next();
};

// --- AUTH ROUTES ---

// 1. Check if Admin account exists
app.get('/api/auth/check-admin', async (req, res) => {
  try {
    const count = await prisma.user.count({ where: { role: 'admin' } });
    res.json({ exists: count > 0 });
  } catch (error) {
    res.status(500).json({ message: 'Error checking admin existence' });
  }
});

// 2. Setup first admin account
app.post('/api/auth/setup-admin', async (req, res) => {
  const { fullname, email, password, schoolName } = req.body;
  try {
    const count = await prisma.user.count({ where: { role: 'admin' } });
    if (count > 0) {
      return res.status(400).json({ message: 'Setup page is disabled permanently. An Admin account already exists.' });
    }

    const hashPassword = await bcrypt.hash(password, 10);
    const assignedSchoolId = schoolName ? schoolName.trim() : 'default-school';
    const user = await prisma.user.create({
      data: {
        fullname,
        email,
        password: hashPassword,
        role: 'admin',
        school_id: assignedSchoolId
      }
    });

    if (schoolName) {
      await prisma.generatorSettings.upsert({
        where: { id: 'default' },
        update: {},
        create: { id: 'default' }
      });
    }

    res.json({ success: true, user: { id: user.id, email: user.email, role: user.role, fullname: user.fullname, school_id: user.school_id } });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create admin profile during setup' });
  }
});

// 3. Register a brand new independent school and its admin credentials
app.post('/api/auth/register-school', async (req, res) => {
  const { fullname, email, password, phone, schoolName, logoUrl } = req.body;
  if (!fullname || !email || !password || !schoolName) {
    return res.status(400).json({ message: 'Owner name, email, password, and school name are required.' });
  }

  try {
    // Check if the user email is already registered
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'An account with this email address already exists.' });
    }

    // Generate a unique, url-safe school_id key to maintain perfect tenant separation
    const slugified = schoolName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const schoolId = `${slugified}-${Math.floor(1000 + Math.random() * 9000)}`;

    const hashPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        fullname,
        email,
        password: hashPassword,
        phone: phone || null,
        role: 'admin',
        school_id: schoolId
      }
    });

    // Seed its dynamic branding profile
    await prisma.schoolBranding.create({
      data: {
        school_id: schoolId,
        logo_url: logoUrl || null,
        primary_color: '#022e66'
      }
    });

    res.json({
      success: true,
      message: 'School tenant and admin profile registered successfully.',
      user: {
        id: user.id,
        fullname: user.fullname,
        email: user.email,
        phone: user.phone,
        role: user.role,
        school_id: user.school_id
      }
    });
  } catch (err: any) {
    console.error('School registration error:', err);
    res.status(500).json({ message: 'Failed to register school. Please verify your fields.', details: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.isVerified === false) {
      return res.status(403).json({ 
        message: 'Account inactive. You must verify and activate your email address before accessing this system. Please check your inbox for the validation email.' 
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ message: 'Invalid password' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, fullname: user.fullname, school_id: user.school_id }, 
      JWT_SECRET, 
      { expiresIn: '24h' }
    );
    res.json({ token, user: { id: user.id, email: user.email, role: user.role, fullname: user.fullname, school_id: user.school_id } });
  } catch (error) {
    res.status(500).json({ message: 'Login failed' });
  }
});

// Verify a password reset/activation token
app.post('/api/auth/verify-token', async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ message: 'Token is required' });
  }

  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    if (decoded.action !== 'setup-password') {
      return res.status(400).json({ message: 'Invalid token action.' });
    }

    // Find user to confirm they exist
    const user = await prisma.user.findUnique({ where: { email: decoded.email } });
    if (!user) {
      return res.status(404).json({ message: 'User associated with this token no longer exists.' });
    }

    // Unslugify school_id for user context/presentation
    const schoolName = getSchoolNameFromId(user.school_id);

    // Fetch school branding details to support logo rendering in verification page
    const branding = await prisma.schoolBranding.findUnique({
      where: { school_id: user.school_id }
    });

    res.json({
      fullname: user.fullname,
      email: user.email,
      schoolName,
      logoUrl: branding?.logo_url || null
    });
  } catch (error: any) {
    console.error('Verify token failed:', error);
    res.status(400).json({ message: 'Token has expired or is invalid.' });
  }
});

// Configure new password using the verified token
app.post('/api/auth/setup-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ message: 'Token and password are required' });
  }

  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    if (decoded.action !== 'setup-password') {
      return res.status(400).json({ message: 'Invalid token action.' });
    }

    const user = await prisma.user.findUnique({ where: { email: decoded.email } });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Set the new hashed password
    const hashPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashPassword }
    });

    res.json({ success: true, message: 'Password has been updated and activated.' });
  } catch (error: any) {
    console.error('Set password via token failed:', error);
    res.status(400).json({ message: 'Failed to verify secure token.' });
  }
});

// GET endpoint to verify teacher email from the activation email link
app.get('/api/auth/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).send(`
      <html>
        <body style="font-family: -apple-system, sans-serif; text-align: center; padding-top: 60px; background-color: #f7fafc;">
          <div style="max-width: 500px; margin: 0 auto; padding: 40px; border: 1px solid #e2e8f0; border-radius: 12px; background: white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <h1 style="color: #e53e3e; font-size: 24px; margin-bottom: 16px;">Verification Error</h1>
            <p style="color: #4a5568; line-height: 1.6;">A secure verification token query parameter is required to activate your profile.</p>
            <a href="/login" style="display: inline-block; margin-top: 24px; padding: 10px 20px; background-color: #3182ce; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Return to Login</a>
          </div>
        </body>
      </html>
    `);
  }

  try {
    const decoded: any = jwt.verify(token as string, JWT_SECRET);
    if (decoded.action !== 'verify-email') {
      return res.status(400).send(`
        <html>
          <body style="font-family: -apple-system, sans-serif; text-align: center; padding-top: 60px; background-color: #f7fafc;">
            <div style="max-width: 500px; margin: 0 auto; padding: 40px; border: 1px solid #e2e8f0; border-radius: 12px; background: white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
              <h1 style="color: #e53e3e; font-size: 24px; margin-bottom: 16px;">Invalid Action</h1>
              <p style="color: #4a5568; line-height: 1.6;">The provided secure token is not configured for email verification actions.</p>
              <a href="/login" style="display: inline-block; margin-top: 24px; padding: 10px 20px; background-color: #3182ce; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Return to Login</a>
            </div>
          </body>
        </html>
      `);
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) {
      return res.status(404).send(`
        <html>
          <body style="font-family: -apple-system, sans-serif; text-align: center; padding-top: 60px; background-color: #f7fafc;">
            <div style="max-width: 500px; margin: 0 auto; padding: 40px; border: 1px solid #e2e8f0; border-radius: 12px; background: white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
              <h1 style="color: #e53e3e; font-size: 24px; margin-bottom: 16px;">User Account Not Found</h1>
              <p style="color: #4a5568; line-height: 1.6;">The user associated with this verification link does not exist anymore in the system database.</p>
              <a href="/login" style="display: inline-block; margin-top: 24px; padding: 10px 20px; background-color: #3182ce; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Return to Login</a>
            </div>
          </body>
        </html>
      `);
    }

    if (user.isVerified) {
      return res.send(`
        <html>
          <body style="font-family: -apple-system, sans-serif; text-align: center; padding-top: 60px; background-color: #f7fafc;">
            <div style="max-width: 500px; margin: 0 auto; padding: 40px; border: 1px solid #e2e8f0; border-radius: 12px; background: white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
              <h1 style="color: #2b6cb0; font-size: 24px; margin-bottom: 16px;">Already Verified</h1>
              <p style="color: #4a5568; line-height: 1.6;">Your teacher account handles is already verified and active! You can proceed to log in directly.</p>
              <a href="/login" style="display: inline-block; margin-top: 24px; padding: 10px 20px; background-color: #3182ce; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Log In Now</a>
            </div>
          </body>
        </html>
      `);
    }

    // Mark email as verified
    await prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true }
    });

    try {
      if (typeof triggerBackup === 'function') {
        triggerBackup();
      }
    } catch (_) {}

    return res.send(`
      <html>
        <body style="font-family: -apple-system, sans-serif; text-align: center; padding-top: 60px; background-color: #f7fafc;">
          <div style="max-width: 500px; margin: 0 auto; padding: 40px; border: 1px solid #cbd5e0; border-radius: 12px; background: white; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
            <div style="display: inline-block; background-color: #def7ec; color: #03543f; padding: 12px; border-radius: 50%; margin-bottom: 16px;">
              <svg style="width: 32px; height: 32px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/1000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h1 style="color: #0e9f6e; font-size: 26px; margin-top: 0; margin-bottom: 12px; font-weight: bold;">✓ Verification Successful!</h1>
            <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">Thank you. Your email address <strong>${user.email}</strong> has been successfully verified, and your teacher account profile is now <strong>active</strong>.</p>
            <p style="color: #4b5563; font-size: 14px; margin-bottom: 24px;">You can now log into the portal using the login credentials provided in your registration email.</p>
            <a href="/login?verified=true" style="display: inline-block; padding: 12px 28px; background-color: #10b981; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.2);">Go to Login Portal</a>
          </div>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error('Email verification error:', err);
    return res.status(400).send(`
      <html>
        <body style="font-family: -apple-system, sans-serif; text-align: center; padding-top: 60px; background-color: #f7fafc;">
          <div style="max-width: 500px; margin: 0 auto; padding: 40px; border: 1px solid #fed7d7; border-radius: 12px; background: white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <h1 style="color: #e53e3e; font-size: 24px; margin-bottom: 16px;">Link Expired or Invalid</h1>
            <p style="color: #4a5568; line-height: 1.6;">The activation or verification link is invalid, malformed, or has expired after 48 hours.</p>
            <p style="color: #718096; font-size: 13px; margin-top: 8px;">Please contact your school administrator to request a new invitation.</p>
            <a href="/login" style="display: inline-block; margin-top: 24px; color: #3182ce; text-decoration: underline; font-weight: 500;">Back to Login</a>
          </div>
        </body>
      </html>
    `);
  }
});

// --- ADMIN ROUTES ---

// Manage Teachers and DOS (Staff)
app.get('/api/teachers', authenticateToken, async (req, res) => {
  try {
    const teachers = await prisma.user.findMany({ 
      where: { 
        role: {
          in: ['teacher', 'dos']
        },
        school_id: req.user.school_id
      },
      select: { id: true, fullname: true, email: true, role: true } // Don't send passwords
    });
    res.json(teachers);
  } catch (error: any) {
    console.error('Failed to get teachers:', error);
    res.status(500).json({ message: 'Failed to fetch staff members' });
  }
});

app.post('/api/teachers', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { fullname, email, password, role } = req.body;
    if (!fullname || !email || !password) {
      return res.status(400).json({ message: 'Full name, email, and password are required.' });
    }

    // Check if the email is already registered to avoid Prisma unique constraint crash
    const existingUser = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (existingUser) {
      return res.status(400).json({ message: 'A user with this email address already exists.' });
    }

    const hashPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { 
        fullname, 
        email: email.trim().toLowerCase(), 
        password: hashPassword, 
        role: role || 'teacher',
        school_id: req.user.school_id,
        isVerified: false
      }
    });

    const baseUrl = req.headers.origin || process.env.APP_URL || 'http://localhost:3000';
    
    // Generate secure validation token
    const verificationToken = jwt.sign(
      { id: user.id, email: user.email, action: 'verify-email' },
      JWT_SECRET,
      { expiresIn: '48h' }
    );

    const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${verificationToken}`;
    const loginUrl = `${baseUrl}/login`;
    const schoolName = getSchoolNameFromId(user.school_id);

    const emailResult = await sendTeacherCredentialsEmail({
      email: user.email,
      fullname: user.fullname,
      schoolName,
      clearPassword: password,
      creatorName: req.user.fullname || 'Administrator',
      loginUrl,
      verifyUrl
    });

    res.json({ 
      id: user.id, 
      fullname: user.fullname, 
      email: user.email, 
      role: user.role, 
      emailSent: emailResult.success,
      previewUrl: emailResult.previewUrl || null
    });
  } catch (error: any) {
    console.error('Failed to create teacher:', error);
    res.status(500).json({ message: 'Failed to create teacher account. Please make sure the email is unique.' });
  }
});

app.put('/api/teachers/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { fullname, email, password, role } = req.body;
    
    // Verify staff belongs to this school
    const existingStaff = await prisma.user.findFirst({
      where: { id: req.params.id, school_id: req.user.school_id }
    });
    if (!existingStaff) {
      return res.status(404).json({ message: 'Staff member not found in your school' });
    }

    // Check if the new email belongs to someone else
    if (email && email.trim().toLowerCase() !== existingStaff.email.toLowerCase()) {
      const existingEmailOwner = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
      if (existingEmailOwner) {
        return res.status(400).json({ message: 'A user with this email address already exists.' });
      }
    }

    const data: any = {};
    if (fullname) data.fullname = fullname;
    if (email) data.email = email.trim().toLowerCase();
    if (role) {
      data.role = role;
    }
    if (password) {
      data.password = await bcrypt.hash(password, 10);
    }
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data
    });
    res.json({ id: user.id, fullname: user.fullname, email: user.email, role: user.role });
  } catch (error: any) {
    console.error('Failed to update teacher:', error);
    res.status(500).json({ message: 'Failed to update teacher profile.' });
  }
});

app.delete('/api/teachers/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    // Verify staff belongs to this school
    const existingStaff = await prisma.user.findFirst({
      where: { id: req.params.id, school_id: req.user.school_id }
    });
    if (!existingStaff) {
      return res.status(404).json({ message: 'Staff member not found in your school' });
    }

    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ message: 'Teacher deleted' });
  } catch (error) {
    res.status(400).json({ message: 'Cannot delete teacher because they have active assignments' });
  }
});

// Classes
app.get('/api/classes', authenticateToken, async (req, res) => {
  const classes = await prisma.class.findMany({ 
    where: { school_id: req.user.school_id },
    include: { _count: { select: { students: true } } } 
  });
  res.json(classes);
});

app.post('/api/classes', authenticateToken, isAdmin, async (req, res) => {
  const { className } = req.body;
  
  // Check if same class name already exists in this school
  const existing = await prisma.class.findFirst({
    where: { className, school_id: req.user.school_id }
  });
  if (existing) {
    return res.status(400).json({ message: 'A class with this name already exists in your school.' });
  }

  const newClass = await prisma.class.create({ 
    data: { 
      className,
      school_id: req.user.school_id
    } 
  });
  res.json(newClass);
});

app.put('/api/classes/:id', authenticateToken, isAdmin, async (req, res) => {
  const { className } = req.body;
  
  // Verify ownership
  const existingClass = await prisma.class.findFirst({
    where: { id: req.params.id, school_id: req.user.school_id }
  });
  if (!existingClass) {
    return res.status(404).json({ message: 'Class not found in your school' });
  }

  // Check unique constraints on Class within this school
  const duplicate = await prisma.class.findFirst({
    where: { className, school_id: req.user.school_id, NOT: { id: req.params.id } }
  });
  if (duplicate) {
    return res.status(400).json({ message: 'A class with this name already exists in your school.' });
  }

  const updated = await prisma.class.update({
    where: { id: req.params.id },
    data: { className }
  });
  res.json(updated);
});

app.delete('/api/classes/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    // Verify ownership
    const existingClass = await prisma.class.findFirst({
      where: { id: req.params.id, school_id: req.user.school_id }
    });
    if (!existingClass) {
      return res.status(404).json({ message: 'Class not found in your school' });
    }

    await prisma.class.delete({ where: { id: req.params.id } });
    res.json({ message: 'Class deleted' });
  } catch (error) {
    res.status(400).json({ message: 'Cannot delete class because it has students or assignments' });
  }
});

// Subjects
app.get('/api/subjects', authenticateToken, async (req, res) => {
  const subjects = await prisma.subject.findMany({
    where: { school_id: req.user.school_id }
  });
  res.json(subjects);
});

app.post('/api/subjects', authenticateToken, isAdmin, async (req, res) => {
  const { subjectName } = req.body;

  // Check unique constraints on Subject within this school
  const duplicate = await prisma.subject.findFirst({
    where: { subjectName, school_id: req.user.school_id }
  });
  if (duplicate) {
    return res.status(400).json({ message: 'A subject with this name already exists in your school.' });
  }

  const subject = await prisma.subject.create({ 
    data: { 
      subjectName,
      school_id: req.user.school_id
    } 
  });
  res.json(subject);
});

app.put('/api/subjects/:id', authenticateToken, isAdmin, async (req, res) => {
  const { subjectName } = req.body;

  // Verify ownership
  const existingSubject = await prisma.subject.findFirst({
    where: { id: req.params.id, school_id: req.user.school_id }
  });
  if (!existingSubject) {
    return res.status(404).json({ message: 'Subject not found in your school' });
  }

  // Check unique constraints on Subject name in this school
  const duplicate = await prisma.subject.findFirst({
    where: { subjectName, school_id: req.user.school_id, NOT: { id: req.params.id } }
  });
  if (duplicate) {
    return res.status(400).json({ message: 'A subject with this name already exists in your school.' });
  }

  const updated = await prisma.subject.update({
    where: { id: req.params.id },
    data: { subjectName }
  });
  res.json(updated);
});

app.delete('/api/subjects/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    await prisma.subject.delete({ where: { id: req.params.id } });
    res.json({ message: 'Subject deleted' });
  } catch (error) {
    res.status(400).json({ message: 'Cannot delete subject because it is in use' });
  }
});

// Students
app.get('/api/students', authenticateToken, async (req, res) => {
  const students = await prisma.student.findMany({ 
    where: { school_id: req.user.school_id },
    include: { class: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json(students);
});

app.post('/api/students', authenticateToken, isAdmin, async (req, res) => {
  const { firstname, lastname, gender, classId } = req.body;
  
  // Verify target class belongs to this school
  const targetClass = await prisma.class.findFirst({
    where: { id: classId, school_id: req.user.school_id }
  });
  if (!targetClass) {
    return res.status(400).json({ message: 'Selected class does not exist in your school.' });
  }

  const student = await prisma.student.create({ 
    data: { 
      firstname, 
      lastname, 
      gender, 
      classId,
      school_id: req.user.school_id
    } 
  });
  res.json(student);
});

app.put('/api/students/:id', authenticateToken, isAdmin, async (req, res) => {
  const { firstname, lastname, gender, classId } = req.body;
  
  // Verify ownership of the student
  const existingStudent = await prisma.student.findFirst({
    where: { id: req.params.id, school_id: req.user.school_id }
  });
  if (!existingStudent) {
    return res.status(404).json({ message: 'Student profile not found in your school' });
  }

  // Verify class belongs to this school
  const targetClass = await prisma.class.findFirst({
    where: { id: classId, school_id: req.user.school_id }
  });
  if (!targetClass) {
    return res.status(400).json({ message: 'Selected class does not exist in your school.' });
  }

  const updated = await prisma.student.update({
    where: { id: req.params.id },
    data: { firstname, lastname, gender, classId }
  });
  res.json(updated);
});

app.delete('/api/students/:id', authenticateToken, isAdmin, async (req, res) => {
  // Verify ownership of the student
  const existingStudent = await prisma.student.findFirst({
    where: { id: req.params.id, school_id: req.user.school_id }
  });
  if (!existingStudent) {
    return res.status(404).json({ message: 'Student profile not found in your school' });
  }

  await prisma.student.delete({ where: { id: req.params.id } });
  res.json({ message: 'Student deleted' });
});

// Assignments
app.get('/api/assignments', authenticateToken, async (req, res) => {
  const assignments = await prisma.teacherAssignment.findMany({
    where: {
      class: {
        school_id: req.user.school_id
      }
    },
    include: { teacher: true, class: true, subject: true }
  });
  res.json(assignments);
});

app.post('/api/assignments', authenticateToken, isAdmin, async (req, res) => {
  const { teacherId, classId, subjectId, periodsPerWeek } = req.body;
  
  // Validate that teacher, class, and subject are in the same school
  const [targetTeacher, targetClass, targetSubject] = await Promise.all([
    prisma.user.findFirst({ where: { id: teacherId, school_id: req.user.school_id } }),
    prisma.class.findFirst({ where: { id: classId, school_id: req.user.school_id } }),
    prisma.subject.findFirst({ where: { id: subjectId, school_id: req.user.school_id } })
  ]);

  if (!targetTeacher || !targetClass || !targetSubject) {
    return res.status(400).json({ message: "Invalid selection: staff, class, or subject belongs to another school." });
  }

  // 1. Check duplicate class + subject combination
  const existingCombo = await prisma.teacherAssignment.findFirst({
    where: { teacherId, classId, subjectId }
  });
  if (existingCombo) {
    return res.status(400).json({ message: "This teacher is already assigned to this class and subject." });
  }

  const assignment = await prisma.teacherAssignment.create({ 
    data: { 
      teacherId, 
      classId, 
      subjectId, 
      periodsPerWeek: periodsPerWeek ? parseInt(periodsPerWeek) : 5 
    } 
  });
  res.json(assignment);
});

app.put('/api/assignments/:id', authenticateToken, isAdmin, async (req, res) => {
  const { teacherId, classId, subjectId, periodsPerWeek } = req.body;
  
  // Verify assignment ownership
  const existingAssign = await prisma.teacherAssignment.findFirst({
    where: {
      id: req.params.id,
      class: { school_id: req.user.school_id }
    }
  });
  if (!existingAssign) {
    return res.status(404).json({ message: "Assignment not found in your school" });
  }

  // Validate that teacher, class, and subject are in the same school
  const [targetTeacher, targetClass, targetSubject] = await Promise.all([
    prisma.user.findFirst({ where: { id: teacherId, school_id: req.user.school_id } }),
    prisma.class.findFirst({ where: { id: classId, school_id: req.user.school_id } }),
    prisma.subject.findFirst({ where: { id: subjectId, school_id: req.user.school_id } })
  ]);

  if (!targetTeacher || !targetClass || !targetSubject) {
    return res.status(400).json({ message: "Invalid selection: staff, class, or subject belongs to another school." });
  }

  // 1. Check duplicate class + subject combination
  const existingCombo = await prisma.teacherAssignment.findFirst({
    where: { 
      teacherId, 
      classId, 
      subjectId,
      NOT: { id: req.params.id }
    }
  });
  if (existingCombo) {
    return res.status(400).json({ message: "This teacher is already assigned to this class and subject." });
  }

  const updated = await prisma.teacherAssignment.update({
    where: { id: req.params.id },
    data: { 
      teacherId, 
      classId, 
      subjectId, 
      periodsPerWeek: periodsPerWeek ? parseInt(periodsPerWeek) : 5 
    }
  });
  res.json(updated);
});

app.delete('/api/assignments/:id', authenticateToken, isAdmin, async (req, res) => {
  // Verify assignment ownership
  const existingAssign = await prisma.teacherAssignment.findFirst({
    where: {
      id: req.params.id,
      class: { school_id: req.user.school_id }
    }
  });
  if (!existingAssign) {
    return res.status(404).json({ message: "Assignment not found in your school" });
  }

  await prisma.teacherAssignment.delete({ where: { id: req.params.id } });
  res.json({ message: 'Assignment deleted' });
});

// --- TEACHER ROUTES ---

app.get('/api/teacher/assignments', authenticateToken, isTeacher, async (req: any, res) => {
  const assignments = await prisma.teacherAssignment.findMany({
    where: { teacherId: req.user.id },
    include: { class: true, subject: true }
  });
  res.json(assignments);
});

app.get('/api/students/by-class/:classId', authenticateToken, async (req: any, res) => {
  const students = await prisma.student.findMany({
    where: { classId: req.params.classId },
    orderBy: { createdAt: 'desc' }
  });
  res.json(students);
});

const calculateCompetency = (total: number) => {
  if (total >= 80) return 'Highly Competent';
  if (total >= 70) return 'Competent';
  if (total >= 50) return 'Basic Competent';
  return 'Not Yet Competent';
};

// Marks Management (TVET Competency-Based Upgraded Logic)
app.get('/api/assessments', authenticateToken, async (req: any, res) => {
  const { studentId, subjectId, classId, term, year, academicYear } = req.query;
  const where: any = { school_id: req.user.school_id };
  if (studentId) where.studentId = studentId as string;
  if (subjectId) where.subjectId = subjectId as string;
  if (term) where.term = term as string;
  if (year) where.year = parseInt(year as string);
  if (academicYear) where.academicYear = academicYear as string;
  if (classId) {
    where.student = { classId: classId as string, school_id: req.user.school_id };
  }
  
  const assessments = await prisma.mark.findMany({
    where,
    include: { student: { include: { class: true } }, subject: true, teacher: true }
  });
  const enriched = await enrichMarksWithWeights(assessments);
  res.json(enriched);
});

app.post('/api/assessments', authenticateToken, isTeacher, async (req: any, res) => {
  const { 
    studentId, 
    subjectId, 
    formativeAssessment, 
    comprehensiveAssessment, 
    practicalAssessment, 
    summativeAssessment, 
    term, 
    year,
    academicYear
  } = req.body;

  // Validate student and subject exist in the user's school
  const [targetStudent, targetSubject] = await Promise.all([
    prisma.student.findFirst({ where: { id: studentId, school_id: req.user.school_id } }),
    prisma.subject.findFirst({ where: { id: subjectId, school_id: req.user.school_id } })
  ]);

  if (!targetStudent || !targetSubject) {
    return res.status(404).json({ message: "Student or Subject was not found in your school." });
  }

  const fa = parseFloat(formativeAssessment) || 0;
  const ca = parseFloat(comprehensiveAssessment) || 0;
  const pa = parseFloat(practicalAssessment) || 0;
  const sa = parseFloat(summativeAssessment) || 0;

  const total = fa + ca + pa + sa;
  const average = total / 4;
  const grade = calculateGrade(total);
  const status = calculateCompetency(total);
  const numericYear = parseInt(year as string) || 2026;
  const stringYear = academicYear || year?.toString() || "2026";

  // Check if same student, subject, term, and year already has an entry
  const existing = await prisma.mark.findFirst({
    where: {
      studentId,
      subjectId,
      term,
      year: numericYear,
      school_id: req.user.school_id
    }
  });

  if (existing) {
    // If the assessments are completely identical, it is a duplicate entry
    const isFaSame = existing.formativeAssessment === fa;
    const isCaSame = existing.comprehensiveAssessment === ca;
    const isPaSame = existing.practicalAssessment === pa;
    const isSaSame = existing.summativeAssessment === sa;

    if (isFaSame && isCaSame && isPaSame && isSaSame) {
      return res.status(400).json({ message: "Duplicate assessment detected." });
    }
  }

  const assessment = await prisma.mark.upsert({
    where: {
      studentId_subjectId_term_year: {
        studentId, subjectId, term, year: numericYear
      }
    },
    update: {
      catMarks: fa + ca, // backwards compatibility
      examMarks: pa + sa, // backwards compatibility
      formativeAssessment: fa,
      comprehensiveAssessment: ca,
      practicalAssessment: pa,
      summativeAssessment: sa,
      totalMarks: total,
      averageMarks: average,
      competencyStatus: status,
      grade,
      academicYear: stringYear,
      teacherId: req.user.id,
      school_id: req.user.school_id
    },
    create: {
      studentId,
      subjectId,
      teacherId: req.user.id,
      catMarks: fa + ca,
      examMarks: pa + sa,
      formativeAssessment: fa,
      comprehensiveAssessment: ca,
      practicalAssessment: pa,
      summativeAssessment: sa,
      totalMarks: total,
      averageMarks: average,
      competencyStatus: status,
      grade,
      term,
      year: numericYear,
      academicYear: stringYear,
      school_id: req.user.school_id
    }
  });
  res.json(assessment);
});

app.put('/api/assessments/:id', authenticateToken, isTeacher, async (req: any, res) => {
  const { 
    formativeAssessment, 
    comprehensiveAssessment, 
    practicalAssessment, 
    summativeAssessment 
  } = req.body;

  // Verify ownership
  const existingMark = await prisma.mark.findFirst({
    where: { id: req.params.id, school_id: req.user.school_id }
  });
  if (!existingMark) {
    return res.status(404).json({ message: "Assessment record not found in your school" });
  }

  const fa = parseFloat(formativeAssessment) || 0;
  const ca = parseFloat(comprehensiveAssessment) || 0;
  const pa = parseFloat(practicalAssessment) || 0;
  const sa = parseFloat(summativeAssessment) || 0;

  const total = fa + ca + pa + sa;
  const average = total / 4;
  const grade = calculateGrade(total);
  const status = calculateCompetency(total);

  const updated = await prisma.mark.update({
    where: { id: req.params.id },
    data: {
      catMarks: fa + ca,
      examMarks: pa + sa,
      formativeAssessment: fa,
      comprehensiveAssessment: ca,
      practicalAssessment: pa,
      summativeAssessment: sa,
      totalMarks: total,
      averageMarks: average,
      competencyStatus: status,
      grade,
      teacherId: req.user.id
    }
  });
  res.json(updated);
});

// TVET Reports API Integration
app.get('/api/reports/student/:id', authenticateToken, async (req, res) => {
  try {
    const { term, year } = req.query;
    const studentId = req.params.id;
    const where: any = { studentId, school_id: req.user.school_id };
    if (term) where.term = term as string;
    if (year) where.year = parseInt(year as string);

    const student = await prisma.student.findFirst({
      where: { id: studentId, school_id: req.user.school_id },
      include: { class: true }
    });

    if (!student) {
      return res.status(404).json({ message: 'Student not found in your school' });
    }

    const assessments = await prisma.mark.findMany({
      where,
      include: { subject: true, teacher: true }
    });

    const classWeights = await getClassSubjectWeights(student.classId);
    const enrichedAssessments = assessments.map(a => {
      const classWeightInfo = classWeights[a.subjectId] || { periods: a.subject.periodsPerWeek, weight: a.subject.subjectWeight };
      const total = a.totalMarks || (a.formativeAssessment + a.comprehensiveAssessment + a.practicalAssessment + a.summativeAssessment);
      const weightedScore = Math.round((total * (classWeightInfo.weight / 100)) * 10) / 10;
      return {
        ...a,
        periods: classWeightInfo.periods,
        subjectWeight: classWeightInfo.weight,
        weightedScore
      };
    });

    res.json({ student, assessments: enrichedAssessments });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching student report' });
  }
});

app.get('/api/reports/class/:id', authenticateToken, async (req, res) => {
  try {
    const { term, year } = req.query;
    const classId = req.params.id;
    const whereMark: any = {};
    if (term) whereMark.term = term as string;
    if (year) whereMark.year = parseInt(year as string);

    const classObj = await prisma.class.findFirst({
      where: { id: classId, school_id: req.user.school_id }
    });

    if (!classObj) {
      return res.status(404).json({ message: 'Class not found in your school' });
    }

    const students = await prisma.student.findMany({
      where: { classId, school_id: req.user.school_id },
      include: {
        marks: {
          where: {
            ...whereMark,
            school_id: req.user.school_id
          },
          include: { subject: true, teacher: true }
        }
      }
    });

    const classWeights = await getClassSubjectWeights(classId);
    const enrichedStudents = students.map(s => {
      const enrichedMarks = s.marks.map(mark => {
        const classWeightInfo = classWeights[mark.subjectId] || { periods: mark.subject.periodsPerWeek, weight: mark.subject.subjectWeight };
        const total = mark.totalMarks || (mark.formativeAssessment + mark.comprehensiveAssessment + mark.practicalAssessment + mark.summativeAssessment);
        const weightedScore = Math.round((total * (classWeightInfo.weight / 100)) * 10) / 10;
        return {
          ...mark,
          periods: classWeightInfo.periods,
          subjectWeight: classWeightInfo.weight,
          weightedScore
        };
      });
      return {
        ...s,
        marks: enrichedMarks
      };
    });

    res.json({ class: classObj, students: enrichedStudents });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching class reports' });
  }
});

app.get('/api/reports/pdf/:id', authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;
    const mark = await prisma.mark.findFirst({
      where: { id, school_id: req.user.school_id },
      include: {
        student: { include: { class: true } },
        subject: true,
        teacher: true
      }
    });

    if (mark) {
      return res.json({ type: 'single', data: mark });
    }

    const student = await prisma.student.findFirst({
      where: { id: id, school_id: req.user.school_id },
      include: { class: true }
    });

    if (student) {
      const assessments = await prisma.mark.findMany({
        where: { studentId: id, school_id: req.user.school_id },
        include: { subject: true, teacher: true }
      });
      return res.json({ type: 'student', student, assessments });
    }

    res.status(404).json({ message: 'Resource not found for PDF metadata or access denied' });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching PDF reports metadata' });
  }
});

// Backward compatibility routes for existing code
app.get('/api/marks', authenticateToken, async (req: any, res) => {
  const { studentId, subjectId, classId, term, year, academicYear } = req.query;
  const where: any = { school_id: req.user.school_id };
  if (studentId) where.studentId = studentId as string;
  if (subjectId) where.subjectId = subjectId as string;
  if (term) where.term = term as string;
  if (year) where.year = parseInt(year as string);
  if (academicYear) where.academicYear = academicYear as string;
  if (classId) {
    where.student = { classId: classId as string, school_id: req.user.school_id };
  }
  
  const marks = await prisma.mark.findMany({
    where,
    include: { student: { include: { class: true } }, subject: true, teacher: true }
  });
  const enriched = await enrichMarksWithWeights(marks);
  res.json(enriched);
});

app.post('/api/marks', authenticateToken, isTeacher, async (req: any, res) => {
  const { 
    studentId, 
    subjectId, 
    catMarks, 
    examMarks, 
    formativeAssessment, 
    comprehensiveAssessment, 
    practicalAssessment, 
    summativeAssessment, 
    term, 
    year,
    academicYear 
  } = req.body;

  // Validate student and subject exist in the user's school
  const [targetStudent, targetSubject] = await Promise.all([
    prisma.student.findFirst({ where: { id: studentId, school_id: req.user.school_id } }),
    prisma.subject.findFirst({ where: { id: subjectId, school_id: req.user.school_id } })
  ]);

  if (!targetStudent || !targetSubject) {
    return res.status(404).json({ message: "Student or Subject was not found in your school." });
  }

  // Derive or use assessments directly
  let fa = parseFloat(formativeAssessment);
  let ca = parseFloat(comprehensiveAssessment);
  let pa = parseFloat(practicalAssessment);
  let sa = parseFloat(summativeAssessment);

  // Fallback to catMarks/examMarks split if TVET not directly supplied
  if (isNaN(fa) && isNaN(ca)) {
    const rawCat = parseFloat(catMarks) || 0;
    fa = Math.round(rawCat * 0.4 * 10) / 10;
    ca = Math.round(rawCat * 0.6 * 10) / 10;
  }
  if (isNaN(pa) && isNaN(sa)) {
    const rawExam = parseFloat(examMarks) || 0;
    pa = Math.round(rawExam * 0.5 * 10) / 10;
    sa = Math.round(rawExam * 0.5 * 10) / 10;
  }

  const total = fa + ca + pa + sa;
  const average = total / 4;
  const grade = calculateGrade(total);
  const status = calculateCompetency(total);
  const numericYear = parseInt(year as string) || 2026;
  const stringYear = academicYear || year?.toString() || "2026";

  const mark = await prisma.mark.upsert({
    where: {
      studentId_subjectId_term_year: {
        studentId, subjectId, term, year: numericYear
      }
    },
    update: {
      catMarks: parseFloat(catMarks || (fa + ca).toString()),
      examMarks: parseFloat(examMarks || (pa + sa).toString()),
      formativeAssessment: fa,
      comprehensiveAssessment: ca,
      practicalAssessment: pa,
      summativeAssessment: sa,
      totalMarks: total,
      averageMarks: average,
      competencyStatus: status,
      grade,
      academicYear: stringYear,
      teacherId: req.user.id,
      school_id: req.user.school_id
    },
    create: {
      studentId,
      subjectId,
      teacherId: req.user.id,
      catMarks: parseFloat(catMarks || (fa + ca).toString()),
      examMarks: parseFloat(examMarks || (pa + sa).toString()),
      formativeAssessment: fa,
      comprehensiveAssessment: ca,
      practicalAssessment: pa,
      summativeAssessment: sa,
      totalMarks: total,
      averageMarks: average,
      competencyStatus: status,
      grade,
      term,
      year: numericYear,
      academicYear: stringYear,
      school_id: req.user.school_id
    }
  });
  res.json(mark);
});

// Statistics
app.get('/api/stats', authenticateToken, async (req, res) => {
  try {
    const { year } = req.query;
    let targetYear = 2026;
    if (year) {
      const parsed = parseInt(year as string, 10);
      if (!isNaN(parsed)) {
        targetYear = parsed;
      }
    }

    const [students, teachers, classes, subjects] = await Promise.all([
      prisma.student.count({ where: { school_id: req.user.school_id } }),
      prisma.user.count({ where: { role: 'teacher', school_id: req.user.school_id } }),
      prisma.class.count({ where: { school_id: req.user.school_id } }),
      prisma.subject.count({ where: { school_id: req.user.school_id } })
    ]);

    // Calculate actual performance average by class for the selected year
    const classesList = await prisma.class.findMany({
      where: { school_id: req.user.school_id },
      include: {
        students: {
          where: { school_id: req.user.school_id },
          include: {
            marks: {
              where: { year: targetYear, school_id: req.user.school_id }
            }
          }
        }
      }
    });

    const performance = classesList.map(c => {
      let sum = 0;
      let count = 0;
      c.students.forEach(student => {
        student.marks.forEach(mark => {
          sum += mark.totalMarks;
          count++;
        });
      });
      const avg = count > 0 ? Math.round((sum / count) * 10) / 10 : 0;
      return {
        name: c.className,
        avg: avg || 0
      };
    });

    // Query recent activities for this academic year
    const recentMarks = await prisma.mark.findMany({
      where: { year: targetYear, school_id: req.user.school_id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        student: true,
        subject: true,
        teacher: true
      }
    });

    const activities = recentMarks.map(m => ({
      user: m.teacher.fullname,
      action: `entered ${m.totalMarks}% (${m.grade}) for`,
      target: `${m.student.firstname} ${m.student.lastname} in ${m.subject.subjectName}`,
      time: m.createdAt
    }));

    res.json({ students, teachers, classes, subjects, performance, activities });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ message: 'Error loading dashboard statistics' });
  }
});

// --- TIMETABLE ROUTES ---

// Weekdays
app.get('/api/weekdays', authenticateToken, async (req, res) => {
  const weekdays = await prisma.weekday.findMany({ orderBy: { id: 'asc' } });
  res.json(weekdays);
});

// Time Slots
app.get('/api/time-slots', authenticateToken, async (req, res) => {
  const slots = await prisma.timeSlot.findMany({ orderBy: { startTime: 'asc' } });
  res.json(slots);
});

app.post('/api/time-slots', authenticateToken, isDosOrAdmin, async (req, res) => {
  const { startTime, endTime, slotType } = req.body;
  const slot = await prisma.timeSlot.create({ data: { startTime, endTime, slotType } });
  res.json(slot);
});

app.put('/api/time-slots/:id', authenticateToken, isDosOrAdmin, async (req, res) => {
  const { startTime, endTime, slotType } = req.body;
  const updated = await prisma.timeSlot.update({
    where: { id: req.params.id },
    data: { startTime, endTime, slotType }
  });
  res.json(updated);
});

app.delete('/api/time-slots/:id', authenticateToken, isDosOrAdmin, async (req, res) => {
  try {
    // Delete any dependent Timetable entries first to avoid foreign key violations
    await prisma.timetable.deleteMany({
      where: { timeSlotId: req.params.id }
    });
    
    await prisma.timeSlot.delete({ where: { id: req.params.id } });
    res.json({ message: 'Slot deleted' });
  } catch (error: any) {
    console.error('Error deleting time slot:', error);
    res.status(400).json({ message: 'Failed to delete slot: ' + (error.message || error) });
  }
});

// Timetable Entries

// Timetable Business Rules Configuration
// To make it configurable and easily editable, we define a declarative rules structure.
export interface TimetableFreeSlotRule {
  dayName: string;
  isFreeSlot: (slotIndex: number, totalSlotsCount: number) => boolean;
}

export const TIMETABLE_FREE_SLOT_RULES: TimetableFreeSlotRule[] = [
  {
    dayName: 'Wednesday',
    isFreeSlot: (slotIndex: number, totalSlotsCount: number) => {
      // Free slots are defined as the last 3 periods/slots of the instructional day
      return slotIndex >= totalSlotsCount - 3;
    }
  }
];

export function isSlotReservedFree(dayName: string, slotIndex: number, totalSlotsCount: number): boolean {
  if (!dayName) return false;
  const rule = TIMETABLE_FREE_SLOT_RULES.find(
    r => r.dayName.toLowerCase() === dayName.toLowerCase()
  );
  if (!rule) return false;
  return rule.isFreeSlot(slotIndex, totalSlotsCount);
}

app.get('/api/timetable', authenticateToken, async (req, res) => {
  const { classId, teacherId } = req.query;
  const where: any = {};
  if (classId) where.classId = classId as string;
  if (teacherId) where.teacherId = teacherId as string;

  const timetable = await prisma.timetable.findMany({
    where,
    include: { class: true, subject: true, teacher: true, timeSlot: true, weekday: true }
  });
  res.json(timetable);
});

app.post('/api/timetable', authenticateToken, isDosOrAdmin, async (req, res) => {
  const { classId, subjectId, teacherId, timeSlotId, weekdayId } = req.body;
  
  // 1. Break / Lunch conflict check
  const slot = await prisma.timeSlot.findUnique({
    where: { id: timeSlotId }
  });
  if (slot && (slot.slotType === 'break' || slot.slotType === 'lunch' || slot.slotType === 'Break' || slot.slotType === 'Lunch')) {
    return res.status(400).json({ message: "Cannot schedule during a break or lunch slot." });
  }

  // 1b. Check configurable Timetable business rules (e.g., Wednesday last 3 slots are reserved as FREE)
  const weekday = await prisma.weekday.findUnique({
    where: { id: weekdayId }
  });
  if (weekday) {
    const settings = await prisma.generatorSettings.findUnique({ where: { id: 'default' } });
    const maxPeriods = settings?.periodsPerDay || 8;
    const activeSlots = await prisma.timeSlot.findMany({ 
      where: { slotType: { in: ['class', 'Class'] } },
      orderBy: { startTime: 'asc' } 
    }).then(slots => slots.slice(0, maxPeriods));
    
    const slotIdx = activeSlots.findIndex(s => s.id === timeSlotId);
    if (slotIdx !== -1 && isSlotReservedFree(weekday.dayName, slotIdx, activeSlots.length)) {
      return res.status(400).json({ 
        message: "Wednesday (Kuwa 3) last 3 periods are reserved as FREE blocks. Scheduling lessons is forbidden." 
      });
    }
  }

  // 2. Exact duplicate entry check
  const existingDupe = await prisma.timetable.findFirst({
    where: { classId, weekdayId, timeSlotId, subjectId }
  });
  if (existingDupe) {
    return res.status(400).json({ message: "This assignment already exists." });
  }

  // 3. Class conflict (class already has a lesson at this time-day)
  const classOccupied = await prisma.timetable.findFirst({
    where: { classId, weekdayId, timeSlotId }
  });
  if (classOccupied) {
    return res.status(400).json({ message: "Class already occupied." });
  }

  // 4. Teacher conflict (teacher is busy at this time-day)
  if (teacherId) {
    const teacherBusy = await prisma.timetable.findFirst({
      where: { teacherId, weekdayId, timeSlotId }
    });
    if (teacherBusy) {
      return res.status(400).json({ message: "Teacher already busy during this time." });
    }
  }

  const entry = await prisma.timetable.create({
    data: { classId, subjectId, teacherId, timeSlotId, weekdayId }
  });
  await recalculateSubjectWeights();
  res.json(entry);
});

app.delete('/api/timetable/:id', authenticateToken, isDosOrAdmin, async (req, res) => {
  await prisma.timetable.delete({ where: { id: req.params.id } });
  await recalculateSubjectWeights();
  res.json({ message: 'Timetable entry deleted' });
});

app.put('/api/timetable/:id', authenticateToken, isDosOrAdmin, async (req, res) => {
  const { classId, subjectId, teacherId, timeSlotId, weekdayId } = req.body;

  // 1. Break / Lunch conflict check
  const slot = await prisma.timeSlot.findUnique({
    where: { id: timeSlotId }
  });
  if (slot && (slot.slotType === 'break' || slot.slotType === 'lunch' || slot.slotType === 'Break' || slot.slotType === 'Lunch')) {
    return res.status(400).json({ message: "Cannot schedule during a break or lunch slot." });
  }

  // 1b. Check configurable Timetable business rules (e.g., Wednesday last 3 slots are reserved as FREE)
  const weekday = await prisma.weekday.findUnique({
    where: { id: weekdayId }
  });
  if (weekday) {
    const settings = await prisma.generatorSettings.findUnique({ where: { id: 'default' } });
    const maxPeriods = settings?.periodsPerDay || 8;
    const activeSlots = await prisma.timeSlot.findMany({ 
      where: { slotType: { in: ['class', 'Class'] } },
      orderBy: { startTime: 'asc' } 
    }).then(slots => slots.slice(0, maxPeriods));
    
    const slotIdx = activeSlots.findIndex(s => s.id === timeSlotId);
    if (slotIdx !== -1 && isSlotReservedFree(weekday.dayName, slotIdx, activeSlots.length)) {
      return res.status(400).json({ 
        message: "Wednesday (Kuwa 3) last 3 periods are reserved as FREE blocks. Scheduling lessons is forbidden." 
      });
    }
  }

  // 2. Exact duplicate entry check
  const existingDupe = await prisma.timetable.findFirst({
    where: { 
      classId, 
      weekdayId, 
      timeSlotId, 
      subjectId,
      NOT: { id: req.params.id }
    }
  });
  if (existingDupe) {
    return res.status(400).json({ message: "This assignment already exists." });
  }

  // 3. Class conflict 
  const classOccupied = await prisma.timetable.findFirst({
    where: { 
      classId, 
      weekdayId, 
      timeSlotId,
      NOT: { id: req.params.id }
    }
  });
  if (classOccupied) {
    return res.status(400).json({ message: "Class already occupied." });
  }

  // 4. Teacher conflict
  if (teacherId) {
    const teacherBusy = await prisma.timetable.findFirst({
      where: { 
        teacherId, 
        weekdayId, 
        timeSlotId,
        NOT: { id: req.params.id }
      }
    });
    if (teacherBusy) {
      return res.status(400).json({ message: "Teacher already busy during this time." });
    }
  }

  const updated = await prisma.timetable.update({
    where: { id: req.params.id },
    data: { classId, subjectId, teacherId, timeSlotId, weekdayId }
  });
  await recalculateSubjectWeights();
  res.json(updated);
});

app.put('/api/marks/:id', authenticateToken, isTeacher, async (req: any, res) => {
  const { catMarks, examMarks } = req.body;

  // Verify ownership
  const existingMark = await prisma.mark.findFirst({
    where: { id: req.params.id, school_id: req.user.school_id }
  });
  if (!existingMark) {
    return res.status(404).json({ message: "Mark record not found in your school." });
  }

  const total = parseFloat(catMarks) + parseFloat(examMarks);
  const grade = calculateGrade(total);
  
  const updated = await prisma.mark.update({
    where: { id: req.params.id },
    data: {
      catMarks: parseFloat(catMarks),
      examMarks: parseFloat(examMarks),
      totalMarks: total,
      grade,
      teacherId: req.user.id
    }
  });
  res.json(updated);
});

app.get('/api/timetable-diagnostics', authenticateToken, isDosOrAdmin, async (req, res) => {
  const [teachers, classes, subjects, assignments, allSlots, weekdays, entries] = await Promise.all([
    prisma.user.count({ where: { role: 'teacher' } }),
    prisma.class.count(),
    prisma.subject.count(),
    prisma.teacherAssignment.count(),
    prisma.timeSlot.findMany(),
    prisma.weekday.count(),
    prisma.timetable.count()
  ]);
  
  const classSlots = allSlots.filter(s => (s.slotType || '').toLowerCase() === 'class').length;
  
  res.json({ teachers, classes, subjects, assignments, slots: classSlots, weekdays, entries });
});

// Timetable Generator (Advanced Constraint Solver)
app.post('/api/timetable/auto-generate', authenticateToken, isDosOrAdmin, async (req, res) => {
  console.log('Starting advanced timetable constraint solver...');
  const { clearExisting } = req.body;

  try {
    if (clearExisting) {
      await prisma.timetable.deleteMany({});
    }

    const weekdays = await prisma.weekday.findMany();
    const settings = await prisma.generatorSettings.findUnique({ where: { id: 'default' } });
    const maxPeriods = settings?.periodsPerDay || 8;

    const allSlots = await prisma.timeSlot.findMany({ 
      where: { 
        slotType: {
          in: ['class', 'Class']
        }
      },
      orderBy: { startTime: 'asc' } 
    });
    
    // Respect configured periods per day
    const activeSlots = allSlots.slice(0, maxPeriods);
    
    const assignments = await prisma.teacherAssignment.findMany({
      include: { class: true, teacher: true, subject: true }
    });
    const classes = await prisma.class.findMany();
    
    console.log(`Auto-generate started. Data counts: Weekdays: ${weekdays.length}, Slots: ${activeSlots.length} (out of ${allSlots.length}), Assignments: ${assignments.length}`);

    // Ensure numeric values for periods
    assignments.forEach(a => {
      if (typeof a.periodsPerWeek !== 'number') {
        a.periodsPerWeek = parseInt(a.periodsPerWeek as any) || 5;
      }
    });

    if (weekdays.length === 0 || allSlots.length === 0 || assignments.length === 0) {
      const missing = [];
      if (weekdays.length === 0) missing.push('Weekdays (Manage Settings)');
      if (allSlots.length === 0) missing.push('Instructional Time Slots (Type: class)');
      if (assignments.length === 0) missing.push('Teacher Assignments');
      
      console.warn('Generation aborted: Missing data', missing);
      return res.status(400).json({ 
        success: false,
        message: `Cannot generate timetable: ${missing.join(', ')}`,
        missing
      });
    }

    // --- State Initialization ---
    const teacherBusy = new Set<string>(); // "dayId-slotId-teacherId"
    const classBusy = new Set<string>();   // "dayId-slotId-classId"
    const classSubjectDayCount: Record<string, number> = {}; // "classId-subjectId-dayId"
    const assignmentFulfilled: Record<string, number> = {}; // "assignmentId"
    const results: any[] = [];

    // Load existing state if not clearing
    if (!clearExisting) {
      const existing = await prisma.timetable.findMany();
      existing.forEach(e => {
        if (e.teacherId) teacherBusy.add(`${e.weekdayId}-${e.timeSlotId}-${e.teacherId}`);
        classBusy.add(`${e.weekdayId}-${e.timeSlotId}-${e.classId}`);
        
        const csdKey = `${e.classId}-${e.subjectId}-${e.weekdayId}`;
        classSubjectDayCount[csdKey] = (classSubjectDayCount[csdKey] || 0) + 1;

        const assign = assignments.find(a => a.classId === e.classId && a.subjectId === e.subjectId && a.teacherId === e.teacherId);
        if (assign) assignmentFulfilled[assign.id] = (assignmentFulfilled[assign.id] || 0) + 1;
      });
    }

    // --- The Solver Logic ---
    // Sort assignments: prioritize those with many periods to fill
    const pendingAssignments = [...assignments]
      .filter(a => (a.periodsPerWeek - (assignmentFulfilled[a.id] || 0)) > 0)
      .sort((a, b) => (b.periodsPerWeek - (assignmentFulfilled[b.id] || 0)) - (a.periodsPerWeek - (assignmentFulfilled[a.id] || 0)));

    for (const assign of pendingAssignments) {
      let remaining = assign.periodsPerWeek - (assignmentFulfilled[assign.id] || 0);
      
      // Shuffle for variety
      const shuffledDays = [...weekdays].sort(() => Math.random() - 0.5);
      const shuffledSlots = [...activeSlots].sort(() => Math.random() - 0.5);

      for (const day of shuffledDays) {
        if (remaining <= 0) break;
        
        for (const slot of shuffledSlots) {
          if (remaining <= 0) break;

          // Check if this slot and weekday combination is reserved as a FREE block per business rules
          const slotIdx = activeSlots.findIndex(s => s.id === slot.id);
          if (isSlotReservedFree(day.dayName, slotIdx, activeSlots.length)) {
            continue; // Bypass and keep this slot FREE
          }

          const tBusyKey = `${day.id}-${slot.id}-${assign.teacherId}`;
          const cBusyKey = `${day.id}-${slot.id}-${assign.classId}`;
          const csdKey = `${assign.classId}-${assign.subjectId}-${day.id}`;

          // CONSTRAINTS:
          // 1. Teacher must be free
          // 2. Class must be free
          // 3. Prevent excessive repetition of subject on same day (max 2)
          if (!teacherBusy.has(tBusyKey) && 
              !classBusy.has(cBusyKey) && 
              (classSubjectDayCount[csdKey] || 0) < 2) {
            
            teacherBusy.add(tBusyKey);
            classBusy.add(cBusyKey);
            classSubjectDayCount[csdKey] = (classSubjectDayCount[csdKey] || 0) + 1;
            assignmentFulfilled[assign.id] = (assignmentFulfilled[assign.id] || 0) + 1;
            remaining--;

            results.push({
              classId: assign.classId,
              subjectId: assign.subjectId,
              teacherId: assign.teacherId,
              timeSlotId: slot.id,
              weekdayId: day.id
            });
          }
        }
      }
    }

    console.log(`Generated ${results.length} session entries.`);

    // Persist results using a fast batch transaction
    if (results.length > 0) {
      await prisma.$transaction(
        results.map(data => prisma.timetable.create({ data }))
      );
    }
    
    await recalculateSubjectWeights();
    
    // Return precisely as requested
    res.json({ 
      success: true,
      message: 'Timetable generated successfully', 
      count: results.length,
      data: results
    });
  } catch (error: any) {
    console.error('Generation error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Generation engine encountered an error',
      error: error.message 
    });
  }
});

// Generator Settings
app.get('/api/generator-settings', authenticateToken, isDosOrAdmin, async (req, res) => {
  try {
    let settings = await prisma.generatorSettings.findUnique({
      where: { id: 'default' }
    });
    if (!settings) {
      settings = await prisma.generatorSettings.create({
        data: { id: 'default' }
      });
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.post('/api/generator-settings', authenticateToken, isDosOrAdmin, async (req, res) => {
  try {
    const settings = await prisma.generatorSettings.upsert({
      where: { id: 'default' },
      update: req.body,
      create: { ...req.body, id: 'default' }
    });
    res.json(settings);
  } catch (error) {
    res.status(400).json({ error: 'Failed to update settings' });
  }
});

// School Branding Settings
app.get('/api/school-branding', async (req: any, res) => {
  try {
    let schoolId = 'default-school';
    
    // Gracing expired or stale tokens by optionally parsing user context rather than throwing 403
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
      try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        if (decoded && decoded.school_id) {
          schoolId = decoded.school_id;
        }
      } catch (err) {
        // Log lightly and gracefully fallback to default
        console.log('Stale or invalid token provided to branding endpoint; falling back to default school branding.');
      }
    }

    const branding = await prisma.schoolBranding.upsert({
      where: { school_id: schoolId },
      update: {},
      create: {
        school_id: schoolId,
        logo_url: null,
        primary_color: '#022e66'
      }
    });
    res.json(branding);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch school branding', details: error.message });
  }
});

app.post('/api/school-branding', authenticateToken, isAdmin, async (req: any, res) => {
  try {
    const schoolId = req.user.school_id || 'default-school';
    const { logo_url, primary_color } = req.body;
    
    let cleanColor = primary_color || '#022e66';
    if (!cleanColor.startsWith('#')) {
      cleanColor = '#' + cleanColor;
    }

    const branding = await prisma.schoolBranding.upsert({
      where: { school_id: schoolId },
      update: {
        logo_url: logo_url === '' ? null : logo_url,
        primary_color: cleanColor
      },
      create: {
        school_id: schoolId,
        logo_url: logo_url === '' ? null : logo_url,
        primary_color: cleanColor
      }
    });
    res.json(branding);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to save school branding', details: error.message });
  }
});

// --- VITE MIDDLEWARE & STATIC SERVING ---

async function seedWeekdays() {
  const count = await prisma.weekday.count();
  if (count === 0) {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    for (const day of days) {
      await prisma.weekday.create({ data: { dayName: day } });
    }
    console.log('Weekdays seeded.');
  }
}

async function seedAdmin() {
  const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
  if (!admin) {
    const hashPassword = await bcrypt.hash('adminpassword', 10);
    await prisma.user.create({
      data: {
        fullname: 'System Administrator',
        email: 'admin@edumetric.com',
        password: hashPassword,
        role: 'admin'
      }
    });
    console.log('Default admin seeded: admin@edumetric.com / adminpassword');
  }
}

async function startServer() {
  let isDbHealthy = false;
  try {
    const dbUrl = process.env.DATABASE_URL;
    console.log('Database connection string initialized:', dbUrl ? `${dbUrl.substring(0, 15)}...` : 'MISSING');
    
    // Test connection
    await prisma.$connect();
    // Verify readable by running a quick query
    await prisma.weekday.count();
    isDbHealthy = true;
    console.log('Database connected and verified healthy on startup.');
  } catch (error: any) {
    console.error('🚨 SQLite database connection failed or table verification failed on startup:', error.message || error);
    console.log('🔄 Resolving startup database error with automated repair and recovery...');
    await runDatabaseRepair();
    try {
      await prisma.$connect();
      await prisma.weekday.count();
      isDbHealthy = true;
      console.log('🔋 Database successfully restored, connected and verified healthy after auto-repair.');
    } catch (retryError: any) {
      console.error('❌ CRITICAL: Failed to connect/verify database even after repair:', retryError.message || retryError);
    }
  }

  if (isDbHealthy) {
    // Apply SQLite DELETE journal optimizations to prevent "database disk image is malformed" and handle concurrency cleanly on Cloud Run
    try {
      await prisma.$queryRawUnsafe(`PRAGMA journal_mode=DELETE;`);
      await prisma.$queryRawUnsafe(`PRAGMA synchronous=NORMAL;`);
      await prisma.$queryRawUnsafe(`PRAGMA busy_timeout=10000;`);
      console.log('SQLite optimizations successfully applied: DELETE journal mode configured.');
    } catch (optErr) {
      console.error('Failed to apply database optimizations:', optErr);
    }

    try {
      await seedWeekdays();
      await recalculateSubjectWeights();
    } catch (err: any) {
      console.error('Failed to run startup seeds/recalculation:', err.message || err);
    }
  }

  // Global Error Handler for SQLite Connection/Malformed errors
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    const errMsg = err?.message || '';
    const isMalformed = errMsg.includes('malformed') || errMsg.includes('corrupt') || errMsg.includes('extended_code: 11');
    
    if (isMalformed) {
      console.error('🚨 Live query failed due to database corruption. Path:', req.path);
      runDatabaseRepair().then(() => {
        res.status(503).json({
          error: 'Database was temporarily corrupted/malformed on the server. We have successfully repaired it. Please refresh or try again.',
          retry: true
        });
      }).catch((repairErr) => {
        console.error('Failed during live database recovery:', repairErr);
        res.status(500).json({ error: 'Database error and recovery failed.' });
      });
      return;
    }
    
    next(err);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
