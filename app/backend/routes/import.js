/**
 * Import API Routes
 * Parse and import ppak backup files
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { parsePpak, extractSoundsFromPpak } = require('../services/ppakParser');
const { saveProject, createDefaultProject, getOptimizedPath } = require('../services/projectStorage');
const { LIBRARY_ROOT } = require('../services/sampleLibrary');

const upload = multer({
  dest: path.join(LIBRARY_ROOT, '.knockout', 'uploads'),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
});

// POST /api/import/ppak - Import a ppak file
router.post('/ppak', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const ppakPath = req.file.path;
    const parsed = await parsePpak(ppakPath);
    
    // Extract sounds to a named folder
    const projectName = req.body.name || 
      path.basename(req.file.originalname, '.ppak').replace(/_backup$/, '') ||
      'Imported Project';
    
    const extractDir = path.join(LIBRARY_ROOT, '.knockout', 'imported', projectName);
    fs.mkdirSync(extractDir, { recursive: true });
    
    const extractedSounds = await extractSoundsFromPpak(ppakPath, extractDir);
    
    // Build project from parsed data
    const project = createDefaultProject(projectName);
    
    // Map sounds
    project.sounds = parsed.sounds.map(sound => {
      const extracted = extractedSounds.find(e => e.filename === sound.filename);
      return {
        slot: sound.slot,
        name: sound.name,
        filename: sound.filename,
        originalPath: extracted ? path.relative(LIBRARY_ROOT, extracted.path) : null,
        optimizedPath: null,
        category: guessCategoryFromSlot(sound.slot),
        size: sound.size,
        imported: true,
      };
    });
    
    // Map pad assignments
    project.padAssignments = parsed.padAssignments;
    
    // Build slotMap
    project.slotMap = {};
    project.sounds.forEach(s => {
      if (s.slot) project.slotMap[s.slot] = s;
    });
    
    // Save project
    const saved = saveProject(project);
    
    // Cleanup upload
    fs.unlinkSync(ppakPath);
    
    res.json({
      success: true,
      project: saved,
      stats: {
        sounds: parsed.sounds.length,
        padAssignments: parsed.padAssignments.length,
        hasProjectData: parsed.hasProjectTar,
      },
    });
    
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/import/ppak/preview - Preview ppak without importing
router.post('/ppak/preview', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const parsed = await parsePpak(req.file.path);
    
    // Cleanup
    fs.unlinkSync(req.file.path);
    
    res.json({
      meta: parsed.meta,
      sounds: parsed.sounds,
      padAssignments: parsed.padAssignments,
      patterns: parsed.patterns,
      stats: {
        soundCount: parsed.sounds.length,
        padCount: parsed.padAssignments.length,
        hasProjectData: parsed.hasProjectTar,
      },
    });
    
  } catch (err) {
    console.error('Preview error:', err);
    res.status(500).json({ error: err.message });
  }
});

function guessCategoryFromSlot(slot) {
  if (slot >= 1 && slot <= 99) return 'kick';
  if (slot >= 100 && slot <= 199) return 'snare';
  if (slot >= 200 && slot <= 299) return 'cymbal';
  if (slot >= 300 && slot <= 399) return 'perc';
  if (slot >= 400 && slot <= 499) return 'bass';
  if (slot >= 500 && slot <= 599) return 'melody';
  if (slot >= 600 && slot <= 699) return 'loop';
  if (slot >= 700 && slot <= 799) return 'user1';
  if (slot >= 800 && slot <= 899) return 'user2';
  if (slot >= 900 && slot <= 999) return 'sfx';
  return 'user1';
}

module.exports = router;
