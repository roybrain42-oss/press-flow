import express from 'express';
import path from 'path';
import fs from 'fs';
import app from './server/app';

async function startServer() {
  // Support cloud-hosted PORT environment variable (e.g. Cloud Run, Railway, Render)
  // or fallback to default container port 3000
  const PORT = Number(process.env.PORT) || 3000;

  // Determine if running the bundled production server in dist/
  const isBundled = typeof __filename !== 'undefined' && (__filename.endsWith('.cjs') || __filename.endsWith('.js'));
  const hasDist = fs.existsSync(path.join(process.cwd(), 'dist', 'index.html'));
  const isProduction = process.env.NODE_ENV === 'production' || isBundled || hasDist;

  // Vite middleware for development or static serving for production
  if (!isProduction) {
    try {
      // Dynamic import prevents vite from being required in production builds
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          hmr: false,
        },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (viteErr) {
      console.warn('[Server] Vite middleware load skipped, falling back to static files:', viteErr);
      const distPath = path.join(process.cwd(), 'dist');
      if (fs.existsSync(distPath)) {
        app.use(express.static(distPath));
        app.get('*', (_req, res) => {
          res.sendFile(path.join(distPath, 'index.html'));
        });
      }
    }
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PrintFlow Server successfully running on http://0.0.0.0:${PORT} [${isProduction ? 'Production' : 'Development'}]`);
  });
}

startServer();

