/**
 * Projects API Routes
 */

const express = require('express');
const router = express.Router();
const {
  listProjects,
  getProject,
  saveProject,
  deleteProject,
  createDefaultProject,
} = require('../services/projectStorage');

// GET /api/projects - List all projects
router.get('/', (req, res) => {
  try {
    const projects = listProjects();
    res.json({ projects });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id - Get a project
router.get('/:id', (req, res) => {
  try {
    const project = getProject(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ project });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects - Create a new project
router.post('/', (req, res) => {
  try {
    const { name, description, bpm, key } = req.body;
    const project = createDefaultProject(name || 'New Project');
    project.description = description || '';
    project.bpm = bpm || 120;
    project.key = key || '';
    
    const saved = saveProject(project);
    res.json({ project: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/projects/:id - Update a project
router.put('/:id', (req, res) => {
  try {
    const existing = getProject(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const updated = { ...existing, ...req.body, id: req.params.id };
    const saved = saveProject(updated);
    res.json({ project: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/projects/:id - Delete a project
router.delete('/:id', (req, res) => {
  try {
    const deleted = deleteProject(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:id/sounds - Add a sound to a project
router.post('/:id/sounds', (req, res) => {
  try {
    const project = getProject(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const sound = req.body;
    if (!sound.slot || !sound.name) {
      return res.status(400).json({ error: 'slot and name are required' });
    }
    
    // Remove existing sound at this slot
    project.sounds = (project.sounds || []).filter(s => s.slot !== sound.slot);
    project.sounds.push(sound);
    
    // Update slotMap
    project.slotMap = project.slotMap || {};
    project.slotMap[sound.slot] = sound;
    
    const saved = saveProject(project);
    res.json({ project: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/projects/:id/sounds/:slot - Remove a sound from a project
router.delete('/:id/sounds/:slot', (req, res) => {
  try {
    const project = getProject(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const slot = parseInt(req.params.slot, 10);
    project.sounds = (project.sounds || []).filter(s => s.slot !== slot);
    delete (project.slotMap || {})[slot];
    
    // Also clear pad assignments using this slot
    project.padAssignments = (project.padAssignments || []).map(a => {
      if (a.config && a.config.slot === slot) {
        return { ...a, config: { ...a.config, slot: 0 } };
      }
      return a;
    });
    
    const saved = saveProject(project);
    res.json({ project: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/projects/:id/pads - Update pad assignments
router.put('/:id/pads', (req, res) => {
  try {
    const project = getProject(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const { padAssignments } = req.body;
    if (!Array.isArray(padAssignments)) {
      return res.status(400).json({ error: 'padAssignments must be an array' });
    }
    
    project.padAssignments = padAssignments;
    const saved = saveProject(project);
    res.json({ project: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/projects/:id/pads/:group/:pad - Update a single pad
router.put('/:id/pads/:group/:pad', (req, res) => {
  try {
    const project = getProject(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const { group, pad } = req.params;
    const padNum = parseInt(pad, 10);
    const config = req.body;
    
    const assignments = project.padAssignments || [];
    const idx = assignments.findIndex(a => a.group === group && a.pad === padNum);
    
    if (idx >= 0) {
      assignments[idx] = { group, pad: padNum, config };
    } else {
      assignments.push({ group, pad: padNum, config });
    }
    
    project.padAssignments = assignments;
    const saved = saveProject(project);
    res.json({ project: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
