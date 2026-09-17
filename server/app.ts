import express, { Request, Response, NextFunction } from 'express';
import authRoutes from './routes/authRoutes';
import publicRoutes from './routes/publicRoutes';
import tenantRoutes from './routes/tenantRoutes';
import adminRoutes from './routes/adminRoutes';
import downloadRoutes from './routes/downloadRoutes';

export function createExpressApp() {
  const app = express();

  // Security and body parsers
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // CORS support for hosted domain routing, PWAs, Vercel, and custom domains
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Basic security headers - allow framing for AI Studio preview iframe
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  // URL normalization for serverless proxies & rewrites (e.g. Vercel, Netlify)
  app.use((req, _res, next) => {
    // If request arrived via a Vercel serverless rewrite that stripped /api or passed original in headers
    const xMatchedPath = (req.headers['x-matched-path'] || req.headers['x-now-route-matches']) as string | undefined;
    if (xMatchedPath && !req.url.startsWith('/api') && xMatchedPath.startsWith('/api')) {
      req.url = xMatchedPath;
    }
    next();
  });

  // Health check endpoints
  const healthHandler = (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      app: 'PrintFlow Multi-Tenant SaaS',
      version: '1.0.0',
      mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
      serverless: Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME),
      timestamp: new Date().toISOString(),
    });
  };

  app.get('/api/health', healthHandler);
  app.get('/health', healthHandler);
  app.get('/api', healthHandler);

  // Mount API Routers (support both /api/xxx and /xxx for direct and serverless rewrite compatibility)
  app.use('/api/auth', authRoutes);
  app.use('/auth', authRoutes);

  app.use('/api/public', publicRoutes);
  app.use('/public', publicRoutes);

  app.use('/api/tenant', tenantRoutes);
  app.use('/tenant', tenantRoutes);

  app.use('/api/admin', adminRoutes);
  app.use('/admin', adminRoutes);

  app.use('/api/download', downloadRoutes);
  app.use('/download', downloadRoutes);

  // Catch unhandled API routes with JSON 404 instead of falling through to SPA HTML
  app.all(['/api/*', '/auth/*', '/public/*', '/tenant/*', '/admin/*', '/download/*'], (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API route not found' });
  });

  // Global Error Handler for API routes
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[API Error]:', err);
    if (err.name === 'MulterError') {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ error: 'Uploaded file exceeds the maximum allowed size limit (35 MB).' });
        return;
      }
      res.status(400).json({ error: `File upload error: ${err.message}` });
      return;
    }
    const status = err.status || 500;
    const message = err.message || 'Internal Server Error';
    res.status(status).json({ error: message });
  });

  return app;
}

export const app = createExpressApp();
export default app;
