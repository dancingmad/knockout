// Load environment variables from .env file
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const express = require('express');
const cors = require('cors');
const expressWs = require('express-ws');

const samplesRouter = require('./routes/samples');
const projectsRouter = require('./routes/projects');
const exportRouter = require('./routes/export');
const importRouter = require('./routes/import');
const audioRouter = require('./routes/audio');
const directRouter = require('./routes/direct');

const app = express();
expressWs(app);

const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const LIBRARY_ROOT = process.env.LIBRARY_ROOT || path.join(__dirname, '../../');
const FRONTEND_DIST = path.join(__dirname, '../frontend/dist');
const KNOCKOUT_DIR = path.join(__dirname, '../../.knockout');

console.log(`[Knockout] Starting in ${NODE_ENV} mode`);
console.log(`[Knockout] Library root: ${LIBRARY_ROOT}`);
console.log(`[Knockout] Data directory: ${KNOCKOUT_DIR}`);

app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

// Request logging in development
if (NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });
}

// Serve static audio files from library
app.use('/library', express.static(LIBRARY_ROOT));

// Serve optimized samples if they exist
app.use('/optimized', express.static(path.join(KNOCKOUT_DIR, 'optimized')));

// API routes
app.use('/api/samples', samplesRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/export', exportRouter);
app.use('/api/import', importRouter);
app.use('/api/audio', audioRouter);
app.use('/api/direct', directRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    libraryRoot: LIBRARY_ROOT,
    dataDir: KNOCKOUT_DIR,
    env: NODE_ENV
  });
});

// Serve built frontend in production or when dist exists
app.use(express.static(FRONTEND_DIST));

// SPA fallback - serve index.html for non-API routes
app.get('*', (req, res) => {
  // Skip API routes
  if (req.url.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  const indexPath = path.join(FRONTEND_DIST, 'index.html');
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({ 
      message: 'Knockout API Server',
      env: NODE_ENV,
      hint: NODE_ENV === 'development' ? 'Run npm run dev:frontend to build the UI' : 'Run npm run build first'
    });
  }
});

app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`[Knockout] Server running on ${url}`);
  
  if (NODE_ENV === 'development') {
    console.log(`[Knockout] Dev mode - API only`);
    console.log(`[Knockout] Start frontend separately: npm run dev:frontend`);
  } else {
    console.log(`[Knockout] Serving built frontend from: ${FRONTEND_DIST}`);
  }
});

module.exports = app;
