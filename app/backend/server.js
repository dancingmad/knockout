const express = require('express');
const cors = require('cors');
const path = require('path');
const expressWs = require('express-ws');

const samplesRouter = require('./routes/samples');
const projectsRouter = require('./routes/projects');
const exportRouter = require('./routes/export');
const importRouter = require('./routes/import');
const audioRouter = require('./routes/audio');

const app = express();
expressWs(app);

const PORT = process.env.PORT || 3001;
const LIBRARY_ROOT = process.env.LIBRARY_ROOT || path.join(__dirname, '../../');

app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

// Serve static audio files from library
app.use('/library', express.static(LIBRARY_ROOT));

// API routes
app.use('/api/samples', samplesRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/export', exportRouter);
app.use('/api/import', importRouter);
app.use('/api/audio', audioRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', libraryRoot: LIBRARY_ROOT });
});

app.listen(PORT, () => {
  console.log(`Knockout backend running on http://localhost:${PORT}`);
  console.log(`Library root: ${LIBRARY_ROOT}`);
});

module.exports = app;
