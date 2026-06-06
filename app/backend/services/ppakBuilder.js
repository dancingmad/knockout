/**
 * ppak Builder Service
 * Constructs KO II .ppak files from project data
 * 
 * ppak format (reverse-engineered from EP-133 backup):
 * - ZIP archive containing:
 *   - /meta.json:              device/format metadata
 *   - /sounds/{slot} {name}.wav: audio files at 46875 Hz, 16-bit
 *   - /projects/P01.tar:      TAR containing:
 *     - pads/{group}/p{01-12}: binary pad config (26 bytes each)
 *     - patterns/{pattern}:    pattern data
 *     - scenes:                scenes binary data
 *     - settings:              settings binary data
 *     - fx_settings:           fx settings binary data
 *
 * IMPORTANT: the ep-sample-tool's Archive parser uses the regex
 *   regex: \.* + /projects/(P##)(.tar|...) and \.* + /sounds/(###) ...
 * which requires a '/' before 'projects/' and 'sounds/'.
 * All standard Node.js ZIP libraries strip leading slashes, so we use
 * a custom ZIP builder (zipBuilder.js) that writes entry names verbatim.
 */

const fs = require('fs');
const path = require('path');
const tar = require('tar');
const os = require('os');
const { buildZip } = require('./zipBuilder');

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
  // Real device scenes data: 612 bytes
  // This is pattern/scene assignment data from a real device backup
  const hex = '00010101010404090101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010101010404010000000100000001000000';
  try {
    return Buffer.from(hex, 'hex');
  } catch (e) {
    return Buffer.alloc(612, 0);
  }
}

/**
 * Build settings binary
 * Template from real device
 */
function buildDefaultSettings() {
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
      const assignment = (project.padAssignments || []).find(
        a => a.group === group && a.pad === padNum
      );
      
      const padBuf = (assignment && assignment.config && assignment.config.slot)
        ? buildPadBinary(assignment.config)
        : buildEmptyPad();
      
      const padFile = `p${String(padNum).padStart(2, '0')}`;
      fs.writeFileSync(path.join(groupDir, padFile), padBuf);
    }
  }
  
  // Create patterns directory with default patterns
  const patternsDir = path.join(tmpDir, 'patterns');
  fs.mkdirSync(patternsDir, { recursive: true });
  
  const patternGroups = ['a', 'b', 'c', 'd'];
  for (const group of patternGroups) {
    fs.writeFileSync(path.join(patternsDir, `${group}01`), buildDefaultPattern());
  }
  
  // Write scenes, settings, fx_settings
  fs.writeFileSync(path.join(tmpDir, 'scenes'), buildDefaultScenes());
  fs.writeFileSync(path.join(tmpDir, 'settings'), buildDefaultSettings());
  fs.writeFileSync(path.join(tmpDir, 'fx_settings'), buildDefaultFxSettings());
  
  // Create TAR archive
  const tarPath = path.join(os.tmpdir(), `P01_${Date.now()}.tar`);
  
  await tar.create(
    { file: tarPath, cwd: tmpDir, portable: true },
    ['.']
  );
  
  const tarData = fs.readFileSync(tarPath);
  
  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.unlinkSync(tarPath);
  
  return tarData;
}

/**
 * Build the complete ppak file.
 *
 * Uses a custom ZIP builder to write entry names with a leading '/' so they
 * match the format the device produces and the ep-sample-tool expects.
 */
async function buildPpak(project) {
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

  const entries = [];

  entries.push({ name: '/meta.json', data: Buffer.from(JSON.stringify(meta, null, 2)) });

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
      entries.push({ name: `/sounds/${soundFilename}`, data: fs.readFileSync(sound.filePath) });
      soundsAdded.add(sound.slot);
    }
  }

  // Build and add project TAR
  const tarData = await buildProjectTar(project);
  entries.push({ name: '/projects/P01.tar', data: tarData });

  return buildZip(entries);
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
