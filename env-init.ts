import dotenv from 'dotenv';
const envConfig = dotenv.config();
if (envConfig.parsed) {
  // Force override system env vars with .env file values
  Object.assign(process.env, envConfig.parsed);
}

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Recursive search for the database file inside the serverless execution directory
function findFileRecursive(dir: string, fileName: string, maxDepth: number = 4): string | null {
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (file === 'node_modules' || file === '.git' || file === '.vercel' || file === 'dist' || file === 'tmp') {
        continue;
      }
      const fullPath = path.join(dir, file);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          if (maxDepth > 0) {
            const found = findFileRecursive(fullPath, fileName, maxDepth - 1);
            if (found) return found;
          }
        } else if (file === fileName) {
          return fullPath;
        }
      } catch (e) {}
    }
  } catch (e) {}
  return null;
}

// Dynamic SQLite database setup to handle read-only hosting platforms like Vercel Serverless
// We set process.env.DATABASE_URL immediately, so ANY module dynamically importing or creating PrismaClient
// inherits this configuration and accesses the writable /tmp directory.
const isVercel = !!process.env.VERCEL || !!process.env.NOW_BUILDER;

if (isVercel) {
  console.log(`[Vercel Serverless Initialization] Current working directory (CWD):`, process.cwd());
  try {
    console.log(`[Vercel Serverless Initialization] CWD directory structure:`, fs.readdirSync(process.cwd()));
  } catch (err: any) {
    console.error(`[Vercel Serverless Initialization] Error reading CWD contents:`, err.message || err);
  }

  const tmpDb = path.join('/tmp', 'dev.db');
  const customDbUrl = process.env.DATABASE_URL;
  const isCustomRemoteDb = customDbUrl && !customDbUrl.startsWith('file:') && !customDbUrl.startsWith('sqlite:');

  if (isCustomRemoteDb) {
    console.log(`[Vercel Serverless] Custom remote DATABASE_URL detected. Skipping SQLite copy and /tmp setup.`);
  } else {
    // Force DATABASE_URL on Vercel to always utilize the writable /tmp filesystem for default SQLite setup
    process.env.DATABASE_URL = `file:${tmpDb}`;
    console.log(`[Vercel Serverless] Setting DATABASE_URL to local writeable SQLite: ${process.env.DATABASE_URL}`);

    // 1. Confirm read/write permissions on the /tmp directory before allowing requests
    try {
      const testFile = path.join('/tmp', `perm_test_${Date.now()}.txt`);
      fs.writeFileSync(testFile, 'test-write-permission');
      const readBack = fs.readFileSync(testFile, 'utf8');
      if (readBack !== 'test-write-permission') {
        throw new Error('Read back content mismatch.');
      }
      fs.unlinkSync(testFile);
      console.log('✅ Successfully confirmed /tmp directory read and write permissions.');
    } catch (err: any) {
      console.error('❌ CRITICAL PERMISSION ERROR: Failed to read/write on /tmp directory:', err.message || err);
    }

    // 2. Clear any existing 0-byte or corrupted DB if present, then copy over the fresh source DB
    let shouldCopy = false;
    if (!fs.existsSync(tmpDb)) {
      shouldCopy = true;
    } else {
      try {
        const stats = fs.statSync(tmpDb);
        if (stats.size === 0) {
          console.warn(`⚠️ Existing database at ${tmpDb} is empty (0 bytes). Deleting to trigger fresh source copy.`);
          fs.unlinkSync(tmpDb);
          shouldCopy = true;
        }
      } catch (e) {
        shouldCopy = true;
      }
    }

    // Find the source database file from multiple possible paths
    const possiblePaths = [
      path.resolve('prisma/dev.db'),
      path.join(process.cwd(), 'prisma', 'dev.db'),
      path.join(__dirname, 'prisma', 'dev.db'),
      path.join(__dirname, '..', 'prisma', 'dev.db'),
    ];
    
    let srcDb = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        srcDb = p;
        break;
      }
    }

    if (!srcDb) {
      // Robust recursive search as fallback
      srcDb = findFileRecursive(process.cwd(), 'dev.db');
      if (!srcDb) {
        srcDb = findFileRecursive(path.resolve(__dirname, '..'), 'dev.db');
      }
    }

    if (srcDb && shouldCopy) {
      try {
        fs.copyFileSync(srcDb, tmpDb);
        console.log(`Database successfully copied from ${srcDb} to writable ${tmpDb} location for Serverless environments.`);
        
        // Also try copying auxiliary SQLite files if they exist
        const srcWal = srcDb + '-wal';
        const srcShm = srcDb + '-shm';
        if (fs.existsSync(srcWal)) {
          try { fs.copyFileSync(srcWal, tmpDb + '-wal'); } catch (e) {}
        }
        if (fs.existsSync(srcShm)) {
          try { fs.copyFileSync(srcShm, tmpDb + '-shm'); } catch (e) {}
        }
      } catch (err) {
        console.error('Error copying dev.db to /tmp:', err);
      }
    } else if (!srcDb && !fs.existsSync(tmpDb)) {
      console.warn('Source database dev.db not found in any of the expected locations or recursive searches:', possiblePaths);
    } else {
      console.log(`Using existing ${tmpDb} database file.`);
    }
  }
} else {
  const curUrl = process.env.DATABASE_URL;
  if (curUrl && (curUrl.startsWith('postgresql:') || curUrl.startsWith('postgres:'))) {
    console.log('PostgreSQL database detected. Keeping DATABASE_URL intact.');
  } else if (curUrl && curUrl.startsWith('file:')) {
    // Convert relative file URL to absolute to ensure both root server and sub-processes resolve the same file path!
    const relativePath = curUrl.substring(5);
    if (!path.isAbsolute(relativePath)) {
      process.env.DATABASE_URL = `file:${path.resolve(process.cwd(), relativePath)}`;
    }
  } else {
    console.warn('⚠️ WARNING: DATABASE_URL is not configured or not valid for PostgreSQL. Please set a valid PostgreSQL connection string (such as from Neon) in your environment variables.');
  }
}

console.log('Environment initialized. DATABASE_URL is:', process.env.DATABASE_URL);
