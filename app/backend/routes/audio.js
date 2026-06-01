/**
 * Audio Processing API Routes
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { getAudioMetadata, optimizeSample, convertAudio } = require('../services/audioProcessor');
const { getProject, saveProject, getOptimizedPath } = require('../services/projectStorage');
const { LIBRARY_ROOT } = require('../services/sampleLibrary');

// GET /api/audio/meta - Get audio file metadata
router.get('/meta', async (req, res) => {
  try {
    const { filePath } = req.query;
    if (!filePath) return res.status(400).json({ error: 'filePath required' });
    
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(LIBRARY_ROOT, filePath);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const meta = await getAudioMetadata(fullPath);
    res.json({ meta });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/audio/optimize - Optimize a single sample
router.post('/optimize', async (req, res) => {
  try {
    const { filePath, category, options } = req.body;
    if (!filePath) return res.status(400).json({ error: 'filePath required' });
    
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(LIBRARY_ROOT, filePath);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const outputPath = getOptimizedPath(fullPath, category || 'misc');
    
    // Skip if already optimized and not forced
    if (fs.existsSync(outputPath) && !options?.force) {
      return res.json({
        success: true,
        outputPath: path.relative(LIBRARY_ROOT, outputPath),
        cached: true,
      });
    }
    
    const result = await optimizeSample(fullPath, outputPath, category || 'misc', options || {});
    
    res.json({
      ...result,
      outputPath: path.relative(LIBRARY_ROOT, outputPath),
      cached: false,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/audio/optimize-project/:id - Optimize all sounds in a project
router.post('/optimize-project/:id', async (req, res) => {
  try {
    const project = getProject(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const results = [];
    const sounds = project.sounds || [];
    
    for (const sound of sounds) {
      const filePath = sound.originalPath;
      if (!filePath) continue;
      
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(LIBRARY_ROOT, filePath);
      if (!fs.existsSync(fullPath)) {
        results.push({ slot: sound.slot, success: false, error: 'File not found' });
        continue;
      }
      
      try {
        const outputPath = getOptimizedPath(fullPath, sound.category);
        
        if (!fs.existsSync(outputPath)) {
          await optimizeSample(fullPath, outputPath, sound.category || 'misc');
        }
        
        sound.optimizedPath = path.relative(LIBRARY_ROOT, outputPath);
        results.push({ slot: sound.slot, success: true, outputPath: sound.optimizedPath });
      } catch (e) {
        results.push({ slot: sound.slot, success: false, error: e.message });
      }
    }
    
    project.sounds = sounds;
    saveProject(project);
    
    res.json({ results, project });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/audio/stream - Stream an audio file for preview
router.get('/stream', (req, res) => {
  try {
    const { filePath } = req.query;
    if (!filePath) return res.status(400).json({ error: 'filePath required' });
    
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(LIBRARY_ROOT, filePath);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const stat = fs.statSync(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    const mimeTypes = {
      '.wav': 'audio/wav',
      '.mp3': 'audio/mpeg',
      '.aiff': 'audio/aiff',
      '.aif': 'audio/aiff',
      '.flac': 'audio/flac',
      '.ogg': 'audio/ogg',
    };
    
    const mimeType = mimeTypes[ext] || 'audio/wav';
    
    // Support range requests for audio seeking
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunkSize = end - start + 1;
      
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': mimeType,
      });
      
      fs.createReadStream(fullPath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': stat.size,
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes',
      });
      fs.createReadStream(fullPath).pipe(res);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
