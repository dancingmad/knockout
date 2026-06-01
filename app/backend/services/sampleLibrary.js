/**
 * Sample Library Service
 * Scans the library root folder and extracts metadata from filenames
 */
const fs = require('fs');
const path = require('path');
const { parseFilenameMetadata } = require('./metadataParser');

const LIBRARY_ROOT = process.env.LIBRARY_ROOT || path.join(__dirname, '../../../');
const AUDIO_EXTENSIONS = ['.wav', '.mp3', '.aiff', '.aif', '.flac', '.ogg'];

// KO II slot category ranges (from device documentation & screenshot)
const SLOT_CATEGORIES = [
  { id: 'kick',   label: 'KICK',   range: [1, 99],    color: '#ff681d' },
  { id: 'snare',  label: 'SNARE',  range: [100, 199], color: '#e84d4d' },
  { id: 'cymbal', label: 'CYMB',   range: [200, 299], color: '#d4a017' },
  { id: 'perc',   label: 'PERC',   range: [300, 399], color: '#8bc34a' },
  { id: 'bass',   label: 'BASS',   range: [400, 499], color: '#2196f3' },
  { id: 'melody', label: 'MELOD',  range: [500, 599], color: '#9c27b0' },
  { id: 'loop',   label: 'LOOP',   range: [600, 699], color: '#00bcd4' },
  { id: 'user1',  label: 'USER 1', range: [700, 799], color: '#607d8b' },
  { id: 'user2',  label: 'USER 2', range: [800, 899], color: '#795548' },
  { id: 'sfx',    label: 'SFX',    range: [900, 999], color: '#f44336' },
];

// Folder name to category mapping
const FOLDER_TO_CATEGORY = {
  'drums': 'kick',
  'kick': 'kick',
  'kicks': 'kick',
  'snare': 'snare',
  'snares': 'snare',
  'cymbal': 'cymbal',
  'cymbals': 'cymbal',
  'hat': 'cymbal',
  'hats': 'cymbal',
  'hi-hat': 'cymbal',
  'hihat': 'cymbal',
  'perc': 'perc',
  'percussion': 'perc',
  'bass': 'bass',
  'synth': 'melody',
  'melody': 'melody',
  'lead': 'melody',
  'loop': 'loop',
  'loops': 'loop',
  'vocal': 'loop',
  'vocals': 'loop',
  'vox': 'loop',
  'fx': 'sfx',
  'sfx': 'sfx',
  'effects': 'sfx',
  'one_shot': null, // determined by subfolder
  'one-shot': null,
  'oneshot': null,
};

/**
 * Guess category from folder path hierarchy
 */
function guessCategoryFromPath(filePath, libraryRoot) {
  const relative = path.relative(libraryRoot, filePath);
  const parts = relative.toLowerCase().split(path.sep);
  
  // Check each path component from deepest to shallowest
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    if (FOLDER_TO_CATEGORY[part] !== undefined && FOLDER_TO_CATEGORY[part] !== null) {
      return FOLDER_TO_CATEGORY[part];
    }
  }
  return 'user1';
}

/**
 * Determine if sample is a loop based on folder structure or filename
 */
function isLoop(filePath, libraryRoot) {
  const relative = path.relative(libraryRoot, filePath).toLowerCase();
  return relative.includes('loop') || relative.includes('loops');
}

/**
 * Get all sample sets (top-level folders in library root)
 */
function getSampleSets() {
  const entries = [];
  try {
    const items = fs.readdirSync(LIBRARY_ROOT);
    for (const item of items) {
      const fullPath = path.join(LIBRARY_ROOT, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory() && !item.startsWith('.') && !item.startsWith('app') && !item.startsWith('project')) {
        entries.push({
          id: item,
          name: item,
          path: fullPath,
          relativePath: item,
        });
      }
    }
  } catch (e) {
    console.error('Error reading library root:', e);
  }
  return entries;
}

/**
 * Recursively scan a directory for audio files
 */
function scanDirectory(dirPath, libraryRoot) {
  const samples = [];
  
  function walk(dir) {
    let items;
    try {
      items = fs.readdirSync(dir);
    } catch (e) {
      return;
    }
    
    for (const item of items) {
      if (item.startsWith('.')) continue;
      const fullPath = path.join(dir, item);
      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch (e) {
        continue;
      }
      
      if (stat.isDirectory()) {
        walk(fullPath);
      } else {
        const ext = path.extname(item).toLowerCase();
        if (AUDIO_EXTENSIONS.includes(ext)) {
          const relativePath = path.relative(libraryRoot, fullPath);
          const meta = parseFilenameMetadata(item);
          const category = guessCategoryFromPath(fullPath, libraryRoot);
          const loop = isLoop(fullPath, libraryRoot);
          
          samples.push({
            id: relativePath.replace(/[/\\]/g, '_').replace(/\s+/g, '-'),
            name: path.basename(item, ext),
            filename: item,
            path: fullPath,
            relativePath: relativePath,
            ext: ext,
            size: stat.size,
            category: loop ? 'loop' : category,
            ...meta,
            isLoop: loop,
          });
        }
      }
    }
  }
  
  walk(dirPath);
  return samples;
}

/**
 * Get samples from a specific set
 */
function getSamplesInSet(setId) {
  const setPath = path.join(LIBRARY_ROOT, setId);
  if (!fs.existsSync(setPath)) {
    return [];
  }
  return scanDirectory(setPath, LIBRARY_ROOT);
}

/**
 * Get all samples across all sets
 */
function getAllSamples() {
  const sets = getSampleSets();
  const allSamples = [];
  for (const set of sets) {
    const samples = scanDirectory(set.path, LIBRARY_ROOT);
    samples.forEach(s => {
      s.setId = set.id;
      s.setName = set.name;
      allSamples.push(s);
    });
  }
  return allSamples;
}

module.exports = {
  getSampleSets,
  getSamplesInSet,
  getAllSamples,
  SLOT_CATEGORIES,
  FOLDER_TO_CATEGORY,
  LIBRARY_ROOT,
};
