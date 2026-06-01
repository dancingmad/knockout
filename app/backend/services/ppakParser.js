/**
 * ppak Parser Service
 * Parses KO II .ppak backup files
 */

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const tar = require('tar');
const os = require('os');

/**
 * Parse a pad binary config (26 bytes)
 */
function parsePadBinary(buf) {
  if (!buf || buf.length < 26) {
    return { slot: 0, inPoint: 0, outPoint: 0, bpm: 0, volume: 100, rootNote: 60 };
  }
  
  return {
    mode: buf.readUInt8(0),
    slot: buf.readUInt16LE(1),
    inPoint: buf.readUInt32LE(4),
    outPoint: buf.readUInt32LE(8),
    bpm: buf.readFloatLE(12),
    volume: buf.readUInt16LE(16),
    flags: buf.readUInt8(20),
    loopFlag: buf.length >= 24 ? buf.readUInt16LE(22) : 0,
    rootNote: buf.length >= 25 ? buf.readUInt8(24) : 60,
  };
}

/**
 * Parse a complete ppak file
 * Returns project data structure
 */
async function parsePpak(ppakPath) {
  const zip = new AdmZip(ppakPath);
  const entries = zip.getEntries();
  
  const result = {
    meta: null,
    sounds: [],
    padAssignments: [],
    patterns: [],
    hasProjectTar: false,
  };

  // Normalize entry name (handle absolute paths like /sounds/...)
  const normName = (e) => e.entryName.replace(/^\//, '');
  
  // Parse meta.json
  const metaEntry = entries.find(e => normName(e) === 'meta.json');
  if (metaEntry) {
    try {
      result.meta = JSON.parse(metaEntry.getData().toString('utf8'));
    } catch (e) {
      console.error('Failed to parse meta.json:', e);
    }
  }
  
  // Parse sound files
  const soundEntries = entries.filter(e => normName(e).startsWith('sounds/'));
  for (const entry of soundEntries) {
    const filename = path.basename(normName(entry));
    const match = filename.match(/^(\d{3})\s+(.+)(\.[^.]+)$/);
    if (match) {
      result.sounds.push({
        slot: parseInt(match[1], 10),
        name: match[2],
        filename: filename,
        ext: match[3],
        size: entry.getData().length,
        entryName: entry.entryName,
      });
    }
  }
  
  // Parse project TAR
  const tarEntry = entries.find(e => normName(e).match(/projects\/P\d+\.tar/));
  if (tarEntry) {
    result.hasProjectTar = true;
    const tmpDir = path.join(os.tmpdir(), `ko2_parse_${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    
    const tarPath = path.join(tmpDir, 'project.tar');
    fs.writeFileSync(tarPath, tarEntry.getData());
    
    try {
      await tar.extract({
        file: tarPath,
        cwd: tmpDir,
      });
      
      // Parse pad files
      const groups = ['a', 'b', 'c', 'd'];
      for (const group of groups) {
        for (let padNum = 1; padNum <= 12; padNum++) {
          const padFile = path.join(tmpDir, 'pads', group, `p${String(padNum).padStart(2, '0')}`);
          if (fs.existsSync(padFile)) {
            const buf = fs.readFileSync(padFile);
            const config = parsePadBinary(buf);
            if (config.slot > 0) {
              result.padAssignments.push({
                group,
                pad: padNum,
                config,
              });
            }
          }
        }
      }
      
      // Parse patterns
      if (fs.existsSync(path.join(tmpDir, 'patterns'))) {
        const patternFiles = fs.readdirSync(path.join(tmpDir, 'patterns'));
        for (const pf of patternFiles) {
          result.patterns.push({
            name: pf,
            size: fs.statSync(path.join(tmpDir, 'patterns', pf)).size,
          });
        }
      }
    } catch (e) {
      console.error('Failed to extract project TAR:', e);
    }
    
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
  
  return result;
}

/**
 * Extract sounds from a ppak to a directory
 */
async function extractSoundsFromPpak(ppakPath, outputDir) {
  const zip = new AdmZip(ppakPath);
  const entries = zip.getEntries();
  
  fs.mkdirSync(outputDir, { recursive: true });
  
  const extracted = [];
  const normName = (e) => e.entryName.replace(/^\//, '');
  const soundEntries = entries.filter(e => normName(e).startsWith('sounds/'));
  
  for (const entry of soundEntries) {
    const filename = path.basename(normName(entry));
    const outputPath = path.join(outputDir, filename);
    fs.writeFileSync(outputPath, entry.getData());
    extracted.push({ filename, path: outputPath });
  }
  
  return extracted;
}

module.exports = {
  parsePpak,
  parsePadBinary,
  extractSoundsFromPpak,
};
