/**
 * Export API Routes
 * Generate ppak files from projects
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { getProject } = require('../services/projectStorage');
const { buildPpak } = require('../services/ppakBuilder');
const { LIBRARY_ROOT } = require('../services/sampleLibrary');

// POST /api/export/:id - Export project as ppak
router.post('/:id', async (req, res) => {
  try {
    const project = getProject(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Resolve file paths
    const sounds = (project.sounds || []).map(sound => {
      let filePath = sound.optimizedPath || sound.originalPath;
      
      // Make absolute if relative
      if (filePath && !path.isAbsolute(filePath)) {
        filePath = path.join(LIBRARY_ROOT, filePath);
      }
      
      return {
        ...sound,
        filePath,
      };
    });
    
    const ppakData = await buildPpak({
      sounds,
      padAssignments: project.padAssignments || [],
      meta: {
        project_name: project.name,
      },
    });
    
    const filename = `${project.name.replace(/[^\w\s-]/g, '').trim()}_P01_backup.ppak`;
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(ppakData);
    
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/export/:id/preview - Preview project export (metadata only, no download)
router.get('/:id/preview', (req, res) => {
  try {
    const project = getProject(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const soundCount = (project.sounds || []).filter(s => s.slot > 0).length;
    const assignedPads = (project.padAssignments || []).filter(
      a => a.config && a.config.slot > 0
    );
    
    // Calculate total size estimate
    const totalSize = (project.sounds || []).reduce((sum, s) => sum + (s.size || 0), 0);
    
    res.json({
      project: {
        id: project.id,
        name: project.name,
        bpm: project.bpm,
        key: project.key,
      },
      stats: {
        soundCount,
        assignedPads: assignedPads.length,
        totalPads: 48,
        estimatedSize: totalSize,
        groups: {
          a: assignedPads.filter(p => p.group === 'a').length,
          b: assignedPads.filter(p => p.group === 'b').length,
          c: assignedPads.filter(p => p.group === 'c').length,
          d: assignedPads.filter(p => p.group === 'd').length,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
