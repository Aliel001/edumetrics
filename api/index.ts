import { app } from '../server.js';

export default async function handler(req: any, res: any) {
  try {
    return app(req, res);
  } catch (err: any) {
    console.error('❌ [Vercel API index] Failed to execute server.js:', err);
    res.status(500).json({
      error: 'Edumetrics Server Module Failure',
      message: err.message || String(err),
      stack: err.stack,
      code: err.code || 'MODULE_EXECUTION_ERROR',
      cwd: process.cwd()
    });
  }
}

