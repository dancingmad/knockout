/**
 * Samples API Routes
 * Browse and manage sample library
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { getSampleSets, getSamplesInSet, getAllSamples, SLOT_CATEGORIES, LIBRARY_ROOT } = require('../services/sampleLibrary');
const { getAudioMetadata } = require('../services/audioProcessor');

// Upload storage for new samples
const upload = multer({
  dest: path.join(LIBRARY_ROOT, '.knockout', 'uploads'),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

// GET /api/samples/sets - List all sample sets
router.get('/sets', (req, res) => {
  try {
    const sets = getSampleSets();
    res.json({ sets });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/samples/sets/:setId - Get samples in a set
router.get('/sets/:setId', (req, res) => {
  try {
    const samples = getSamplesInSet(req.params.setId);
    res.json({ samples });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/samples - Get all samples (with optional filters)
router.get('/', (req, res) => {
  try {
    const { category, search, setId } = req.query;
    let samples = getAllSamples();
    
    if (setId) {
      samples = samples.filter(s => s.setId === setId);
    }
    if (category) {
      samples = samples.filter(s => s.category === category);
    }
    if (search) {
      const q = search.toLowerCase();
      samples = samples.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.filename.toLowerCase().includes(q) ||
        (s.key && s.key.toLowerCase().includes(q))
      );
    }
    
    res.json({ samples, total: samples.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/samples/categories - Get slot categories
router.get('/categories', (req, res) => {
  res.json({ categories: SLOT_CATEGORIES });
});

// GET /api/samples/meta - Get metadata for a specific file
router.get('/meta', async (req, res) => {
  try {
    const { filePath } = req.query;
    if (!filePath) {
      return res.status(400).json({ error: 'filePath required' });
    }
    
    const fullPath = path.join(LIBRARY_ROOT, filePath);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const meta = await getAudioMetadata(fullPath);
    res.json({ meta });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/samples/upload - Upload a new sample
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const { setId, category } = req.body;
    const targetDir = setId
      ? path.join(LIBRARY_ROOT, setId, category || 'misc')
      : path.join(LIBRARY_ROOT, '.knockout', 'uploads');
    
    fs.mkdirSync(targetDir, { recursive: true });
    
    const targetPath = path.join(targetDir, req.file.originalname);
    fs.renameSync(req.file.path, targetPath);
    
    const meta = await getAudioMetadata(targetPath);
    
    res.json({
      success: true,
      path: path.relative(LIBRARY_ROOT, targetPath),
      meta,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
