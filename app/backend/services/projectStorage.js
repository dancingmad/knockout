/**
 * Project Storage Service
 * Manages project JSON files stored locally
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const LIBRARY_ROOT = process.env.LIBRARY_ROOT || path.join(__dirname, '../../../');
const PROJECTS_DIR = path.join(LIBRARY_ROOT, '.knockout', 'projects');
const OPTIMIZED_DIR = path.join(LIBRARY_ROOT, '.knockout', 'optimized');

// Ensure directories exist
function ensureDirs() {
  fs.mkdirSync(PROJECTS_DIR, { recursive: true });
  fs.mkdirSync(OPTIMIZED_DIR, { recursive: true });
}

/**
 * List all projects
 */
function listProjects() {
  ensureDirs();
  const files = fs.readdirSync(PROJECTS_DIR).filter(f => f.endsWith('.json'));
  return files.map(f => {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(PROJECTS_DIR, f), 'utf8'));
      return data;
    } catch (e) {
      return null;
    }
  }).filter(Boolean);
}

/**
 * Get a project by ID
 */
function getProject(id) {
  ensureDirs();
  const filePath = path.join(PROJECTS_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

/**
 * Save/update a project
 */
function saveProject(project) {
  ensureDirs();
  if (!project.id) {
    project.id = uuidv4();
  }
  project.updatedAt = new Date().toISOString();
  if (!project.createdAt) {
    project.createdAt = project.updatedAt;
  }
  
  const filePath = path.join(PROJECTS_DIR, `${project.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(project, null, 2), 'utf8');
  return project;
}

/**
 * Delete a project
 */
function deleteProject(id) {
  ensureDirs();
  const filePath = path.join(PROJECTS_DIR, `${id}.json`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

/**
 * Create a default new project structure
 */
function createDefaultProject(name = 'New Project') {
  const groups = ['a', 'b', 'c', 'd'];
  const padAssignments = [];
  
  // Initialize empty pad grid
  groups.forEach(group => {
    for (let pad = 1; pad <= 12; pad++) {
      padAssignments.push({
        group,
        pad,
        config: {
          slot: 0,
          inPoint: 0,
          outPoint: 0,
          bpm: 0,
          volume: 100,
          rootNote: 60,
          flags: 0xFF,
          loopFlag: 0,
        },
      });
    }
  });
  
  return {
    id: null,
    name,
    description: '',
    bpm: 120,
    key: '',
    sounds: [],        // Array of { slot, name, filename, originalPath, optimizedPath, category }
    padAssignments,    // 4 groups × 12 pads
    slotMap: {},       // slot → sound mapping
    createdAt: null,
    updatedAt: null,
  };
}

/**
 * Get optimized sample path for a given source path
 * @param {string} originalPath - Original file path (or unique identifier)
 * @param {string} category - Sample category (kick, perc, bass, etc.)
 * @param {string|number} uniqueId - Optional unique identifier (slot number or sound name) to prevent hash collisions
 */
function getOptimizedPath(originalPath, category, uniqueId) {
  ensureDirs();
  
  // Use uniqueId if provided, otherwise use full path hash
  // Increased hash length to 50 chars to avoid collisions with similar prefixes
  const identifier = uniqueId || originalPath;
  const hash = Buffer.from(identifier).toString('base64').replace(/[/+=]/g, '_').slice(0, 50);
  
  const catDir = path.join(OPTIMIZED_DIR, category || 'misc');
  fs.mkdirSync(catDir, { recursive: true });
  
  // Also add a safe version of the original filename to make debugging easier
  const safeName = originalPath
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 30);
  
  return path.join(catDir, `${hash}_${safeName}.wav`);
}

module.exports = {
  listProjects,
  getProject,
  saveProject,
  deleteProject,
  createDefaultProject,
  getOptimizedPath,
  PROJECTS_DIR,
  OPTIMIZED_DIR,
};
