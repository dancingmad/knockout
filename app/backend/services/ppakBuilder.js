/**
 * ppak Builder Service
 * Constructs KO II .ppak files from project data
 * 
 * ppak format (reverse-engineered from EP-133 backup):
 * - ZIP archive containing:
 *   - meta.json: device/format metadata
 *   - sounds/{slot} {name}.wav: audio files at 46875 Hz, 16-bit
 *   - projects/P01.tar: TAR containing:
 *     - pads/{group}/p{01-12}: binary pad config (26 bytes each)
 *     - patterns/{pattern}: pattern data
 *     - scenes: scenes binary data
 *     - settings: settings binary data
 *     - fx_settings: fx settings binary data
 */

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const tar = require('tar');
const os = require('os');

const DEVICE_SAMPLE_RATE = 46875;

/**
 * Build a pad binary config (26 bytes)
 * 
 * Layout:
 * - byte 0:     mode/type (0x00)
 * - bytes 1-2:  slot uint16 LE (0 = empty)
 * - byte 3:     0x00
 * - bytes 4-7:  IN point uint32 LE (samples, 0 = start)
 * - bytes 8-11: OUT point uint32 LE (samples, 0 = auto/end)
 * - bytes 12-15: float32 LE (BPM, 0.0 = default/120)
 * - bytes 16-17: volume uint16 LE (100 = default)
 * - bytes 18-19: 0x0000
 * - byte 20:    playback flags (0xFF = default)
 * - byte 21:    0x00
 * - bytes 22-23: mode flags (0x0000 = default)
 * - byte 24:    root note MIDI (0x3C = 60 = C4)
 * - byte 25:    0x00
 */
function buildPadBinary(config = {}) {
  const {
    slot = 0,          // sample slot (1-999, 0 = empty)
    inPoint = 0,       // trim start in samples
    outPoint = 0,      // trim end in samples (0 = play to end)
    bpm = 0.0,         // BPM (0 = not set / use default)
    volume = 100,      // volume (0-100)
    rootNote = 60,     // MIDI root note (60 = C4)
    flags = 0xFF,      // playback flags
    loopFlag = 0,      // loop mode flag
  } = config;

  const buf = Buffer.alloc(26, 0);
  buf.writeUInt8(0x00, 0);                    // mode
  buf.writeUInt16LE(slot, 1);                  // slot number
  buf.writeUInt8(0x00, 3);                     // padding
  buf.writeUInt32LE(inPoint, 4);               // IN point
  buf.writeUInt32LE(outPoint, 8);              // OUT point
  buf.writeFloatLE(bpm, 12);                   // BPM float
  buf.writeUInt16LE(volume, 16);               // volume
  buf.writeUInt16LE(0x0000, 18);               // padding
  buf.writeUInt8(flags, 20);                   // playback flags
  buf.writeUInt8(0x00, 21);                    // padding
  buf.writeUInt16LE(loopFlag, 22);             // loop/mode flags
  buf.writeUInt8(rootNote, 24);                // root note
  buf.writeUInt8(0x00, 25);                    // padding

  return buf;
}

/**
 * Build a default empty pad
 */
function buildEmptyPad() {
  return buildPadBinary({ slot: 0, bpm: 120.0, flags: 0xFF });
}

/**
 * Build the default scenes binary (pattern scene assignments)
 * Template from real device capture - 222 bytes of repeating pattern data
 */
function buildDefaultScenes() {
  // From real device: scenes file with pattern assignments
  // Simple default: 9 scenes, each with default values
  const buf = Buffer.alloc(222, 0);
  // Pattern from captured scenes file
  const pattern = [0x01, 0x01, 0x01, 0x04, 0x04];
  for (let i = 0; i < buf.length; i++) {
    buf[i] = pattern[i % pattern.length];
  }
  buf[0] = 0x00;
  return buf;
}

/**
 * Build settings binary
 * Template from real device
 */
function buildDefaultSettings() {
  // From real device: settings file with default tempo/pitch values
  const hex = '0000000000ca42a6ed7f3fa6ed7f3f0000803f0000803fd09b423f9ca7023fb823243f250619' +
              '3f000000008178053f8bc3a93eb29d3f3f000080bf478f073f000080bfbd8c023fd3f67f3f55f6453f' +
              '000080bfdc46333f000080bf000080bfd252f93e000080bf000080bf2d43dc3d77102b3f000080bf' +
              '96b2143ff7c7fb3e000080bf5bb1573f7b88c63eab5bed3e000080bf3945f73e000080bf93c6f83e' +
              '107a163f52610' + '43f6f9eca3e000080bf000080bf000080bf000080bfa032fe3e000080bfdd41cc3e' +
              '000080bf000080bf000080bf000080bf01000900000' + '1';
  try {
    return Buffer.from(hex.replace(/\s/g, ''), 'hex');
  } catch (e) {
    return Buffer.alloc(222, 0);
  }
}

/**
 * Build fx_settings binary  
 */
function buildDefaultFxSettings() {
  const hex = '00000000060000000000003f00000e3f00000000000' +
              '0d63e0000503e0000163f0000d83e0000003f0000003f0000003f0000003f0000003f0000003f0000003f' +
              '0000443f000000000000003f0000a83e0000de3e0000003f0000003f0000003f0000003f0000003f' +
              '0000003f0000003f0000003f0000000000' + '0000003f000600800080008000';
  try {
    return Buffer.from(hex.replace(/\s/g, ''), 'hex');
  } catch (e) {
    return Buffer.alloc(160, 0);
  }
}

/**
 * Build an empty pattern (minimal valid pattern)
 */
function buildDefaultPattern() {
  return Buffer.from([0x00, 0x01, 0x00, 0x00]);
}

/**
 * Build the project TAR content
 * 
 * @param {Object} project - Project data
 * @param {Array} project.padAssignments - Array of { group: 'a'|'b'|'c'|'d', pad: 1-12, config: PadConfig }
 */
async function buildProjectTar(project) {
  const tmpDir = path.join(os.tmpdir(), `ko2_project_${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  
  // Create pad directories and files
  const groups = ['a', 'b', 'c', 'd'];
  for (const group of groups) {
    const groupDir = path.join(tmpDir, 'pads', group);
    fs.mkdirSync(groupDir, { recursive: true });
    
    for (let padNum = 1; padNum <= 12; padNum++) {
      const padKey = `${group}${padNum}`;
      const assignment = (project.padAssignments || []).find(
        a => a.group === group && a.pad === padNum
      );
      
      let padBuf;
      if (assignment && assignment.config && assignment.config.slot) {
        padBuf = buildPadBinary(assignment.config);
      } else {
        padBuf = buildEmptyPad();
      }
      
      const padFile = `p${String(padNum).padStart(2, '0')}`;
      fs.writeFileSync(path.join(groupDir, padFile), padBuf);
    }
  }
  
  // Create patterns directory with default patterns
  const patternsDir = path.join(tmpDir, 'patterns');
  fs.mkdirSync(patternsDir, { recursive: true });
  
  // Write default patterns for each group
  const patternGroups = ['a', 'b', 'c', 'd'];
  for (const group of patternGroups) {
    fs.writeFileSync(
      path.join(patternsDir, `${group}01`),
      buildDefaultPattern()
    );
  }
  
  // Write scenes
  fs.writeFileSync(path.join(tmpDir, 'scenes'), buildDefaultScenes());
  
  // Write settings  
  fs.writeFileSync(path.join(tmpDir, 'settings'), buildDefaultSettings());
  
  // Write fx_settings
  fs.writeFileSync(path.join(tmpDir, 'fx_settings'), buildDefaultFxSettings());
  
  // Create TAR archive
  const tarPath = path.join(os.tmpdir(), `P01_${Date.now()}.tar`);
  
  await tar.create(
    {
      file: tarPath,
      cwd: tmpDir,
      portable: true,
    },
    ['.']
  );
  
  const tarData = fs.readFileSync(tarPath);
  
  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.unlinkSync(tarPath);
  
  return tarData;
}

/**
 * Build the complete ppak file
 * 
 * @param {Object} project - The project configuration
 * @param {Array} project.sounds - Array of { slot, name, filePath }
 * @param {Array} project.padAssignments - Pad assignments
 * @param {Object} project.meta - Optional metadata overrides
 * @returns {Promise<Buffer>} The ppak ZIP buffer
 */
async function buildPpak(project) {
  return new Promise(async (resolve, reject) => {
    try {
      const chunks = [];
      
      const archive = archiver('zip', {
        zlib: { level: 6 },
      });
      
      archive.on('data', chunk => chunks.push(chunk));
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);
      
      // Build meta.json
      const meta = {
        info: 'teenage engineering - pak file',
        pak_version: 1,
        pak_type: 'project',
        pak_release: '1.2.0',
        device_name: 'EP-133',
        device_sku: 'TE032AS001',
        device_version: '2.0.5',
        generated_at: new Date().toISOString(),
        author: 'knockout',
        base_sku: 'TE032AS001',
        ...(project.meta || {}),
      };
      
      archive.append(JSON.stringify(meta, null, 2), { name: 'meta.json' });
      
      // Add sound files  
      const soundsAdded = new Set();
      for (const sound of (project.sounds || [])) {
        if (!sound.filePath || !sound.slot || soundsAdded.has(sound.slot)) continue;
        
        const ext = path.extname(sound.filePath).toLowerCase();
        const slotStr = String(sound.slot).padStart(3, '0');
        const safeName = sound.name
          .replace(/[^\w\s.-]/g, '')
          .toLowerCase()
          .trim();
        const soundFilename = `${slotStr} ${safeName}${ext}`;
        
        if (fs.existsSync(sound.filePath)) {
          archive.file(sound.filePath, { name: `/sounds/${soundFilename}` });
          soundsAdded.add(sound.slot);
        }
      }
      
      // Build and add project TAR
      const tarData = await buildProjectTar(project);
      archive.append(tarData, { name: '/projects/P01.tar' });
      
      archive.finalize();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Build a ppak with just sounds (for individual sample uploads)
 */
async function buildSoundPpak(sounds) {
  return buildPpak({ sounds, padAssignments: [] });
}

module.exports = {
  buildPpak,
  buildSoundPpak,
  buildPadBinary,
  buildEmptyPad,
  buildProjectTar,
  DEVICE_SAMPLE_RATE,
};
