import app from './app';

// Vercel Serverless Function wrapper with crash-guard protection
export default function handler(req: any, res: any) {
  try {
    return app(req, res);
  } catch (err: any) {
    console.error('[Serverless Handler Fatal Error]:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        error: err?.message || 'Internal serverless handler error',
        timestamp: new Date().toISOString()
      }));
    }
  }
}
