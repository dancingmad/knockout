/**
 * EP-133 SysEx Uploader Service
 * 
 * Formats audio and SysEx commands for direct upload to EP-133
 * This bypasses the .ppak file format entirely
 * 
 * Based on reverse-engineered protocol from ep_133_sysex_thingy
 */

const fs = require('fs');
const path = require('path');
const { JZZ } = require('jzz');

const DEVICE_SAMPLE_RATE = 46875;

// Manufacturer ID for Teenage Engineering
const TE_MANUFACTURER_ID = [0x00, 0x20, 0x76];

// SysEx command codes
const CMD = {
  INIT: 0x17,        // Initialize transfer
  FILE: 0x6c,        // File transfer
  DATA: 0x40,        // Data chunk
  END: 0x60,         // End transfer
  ACK: 0x7f,         // Acknowledgment
};

/**
 * Build TE metadata header for EP-133 WAV files
 * This includes the smpl chunk and LIST INFO TNGE chunk
 */
function buildTEWaveHeader(options = {}) {
  const {
    sampleRate = DEVICE_SAMPLE_RATE,
    channels = 1,
    bitsPerSample = 16,
    playmode = 'oneshot',       // 'oneshot' or 'loop'
    rootNote = 60,              // MIDI note (60 = C4)
    pitch = 0,
    pan = 0,
    amplitude = 100,
    attack = 0,
    release = 255,
    loopStart = 0,
    loopEnd = 0,
    timeMode = 'off',
  } = options;

  // JSON metadata that goes into the LIST INFO TNGE chunk
  const metadata = {
    'sound.playmode': playmode,
    'sound.rootnote': rootNote,
    'sound.pitch': pitch,
    'sound.pan': pan,
    'sound.amplitude': amplitude,
    'envelope.attack': attack,
    'envelope.release': release,
    'time.mode': timeMode,
  };
  
  if (playmode === 'loop' && loopStart > 0) {
    metadata['sound.loopstart'] = loopStart;
    metadata['sound.loopend'] = loopEnd;
  }

  const jsonStr = JSON.stringify(metadata);
  const jsonBuffer = Buffer.from(jsonStr, 'ascii');
  
  // TNGE chunk: 8 bytes header + JSON data + null terminator + padding
  const tngeDataSize = jsonBuffer.length + 1; // +1 for null terminator
  const tngePadding = (tngeDataSize % 2);     // Pad to even
  const tngeTotalSize = 8 + tngeDataSize + tngePadding;
  
  // smpl chunk (36 bytes of sample metadata)
  const smplChunk = Buffer.alloc(36);
  smplChunk.write('smpl', 0, 4, 'ascii');               // Chunk ID
  smplChunk.writeUInt32LE(36 - 8, 4);                   // Chunk size (28 bytes of data)
  smplChunk.writeUInt32LE(0, 8);                        // Manufacturer
  smplChunk.writeUInt32LE(0, 12);                       // Product
  smplChunk.writeUInt32LE(sampleRate, 16);              // Sample period (1/sampleRate)
  smplChunk.writeUInt32LE(0, 20);                       // MIDI unity note
  smplChunk.writeUInt32LE(0, 24);                       // MIDI pitch fraction
  smplChunk.writeUInt32LE(0, 28);                       // SMPTE format
  smplChunk.writeUInt32LE(0, 32);                       // SMPTE offset
  
  // LIST INFO chunk
  const listChunk = Buffer.alloc(8 + tngeTotalSize);
  listChunk.write('LIST', 0, 4, 'ascii');               // Chunk ID
  listChunk.writeUInt32LE(tngeTotalSize, 4);            // List size
  listChunk.write('INFO', 8, 4, 'ascii');               // INFO sub-chunk
  listChunk.write('TNGE', 12, 4, 'ascii');              // TNGE sub-chunk ID
  listChunk.writeUInt32LE(tngeDataSize, 16);            // TNGE size
  jsonBuffer.copy(listChunk, 20);                       // JSON data
  listChunk.writeUInt8(0, 20 + jsonBuffer.length);      // Null terminator
  
  return Buffer.concat([smplChunk, listChunk]);
}

/**
 * Inject TE metadata header into a raw PCM WAV file
 * or create a new WAV with the header from an existing audio file
 */
async function createTEWaveFile(audioData, options = {}) {
  // audioData should be a Buffer of raw PCM data or a WAV file
  // For now, assume it's raw 16-bit PCM at 46875 Hz
  
  const {
    channels = 1,
    bitsPerSample = 16,
    numSamples,
    sampleRate = DEVICE_SAMPLE_RATE,
    ...metaOptions
  } = options;
  
  const audioBytes = Buffer.isBuffer(audioData) ? audioData : Buffer.from(audioData);
  const teHeader = buildTEWaveHeader({ ...metaOptions, channels, bitsPerSample });
  
  // Calculate sizes
  const dataSize = audioBytes.length;
  const riffSize = 4 + (8 + 20) + teHeader.length + (8 + dataSize); // fmt + smpl+list + data
  
  // Build WAV header (without data chunk - will add manually)
  const fmtChunk = Buffer.alloc(24);
  fmtChunk.write('fmt ', 0, 4, 'ascii');                // Chunk ID
  fmtChunk.writeUInt32LE(16, 4);                        // Chunk size (16 bytes)
  fmtChunk.writeUInt16LE(1, 8);                         // Audio format (PCM)
  fmtChunk.writeUInt16LE(channels, 10);                 // Number of channels
  fmtChunk.writeUInt32LE(sampleRate, 12);               // Sample rate
  fmtChunk.writeUInt32LE(sampleRate * channels * bitsPerSample / 8, 16); // Byte rate
  fmtChunk.writeUInt16LE(channels * bitsPerSample / 8, 20); // Block align
  fmtChunk.writeUInt16LE(bitsPerSample, 22);            // Bits per sample
  
  // RIFF header
  const riffHeader = Buffer.alloc(12);
  riffHeader.write('RIFF', 0, 4, 'ascii');              // File ID
  riffHeader.writeUInt32LE(riffSize - 8, 4);            // File size - 8
  riffHeader.write('WAVE', 8, 4, 'ascii');              // WAVE format
  
  // Data chunk header
  const dataChunk = Buffer.alloc(8);
  dataChunk.write('data', 0, 4, 'ascii');
  dataChunk.writeUInt32LE(dataSize, 4);
  
  return Buffer.concat([riffHeader, fmtChunk, teHeader, dataChunk, audioBytes]);
}

/**
 * Convert a standard WAV file to TE format with metadata header
 */
async function convertToTEWave(inputPath, outputPath, metadata = {}) {
  const fs = require('fs');
  
  // Read input file
  const inputData = fs.readFileSync(inputPath);
  
  // Check if it's a WAV and extract PCM data
  if (inputData.toString('ascii', 0, 4) !== 'RIFF') {
    throw new Error('Input file is not a WAV file');
  }
  
  // Find the data chunk and extract raw PCM
  let offset = 12; // After RIFF header
  let audioStart = 0;
  let audioLength = 0;
  
  while (offset < inputData.length - 8) {
    const chunkId = inputData.toString('ascii', offset, offset + 4);
    const chunkSize = inputData.readUInt32LE(offset + 4);
    
    if (chunkId === 'data') {
      audioStart = offset + 8;
      audioLength = chunkSize;
      break;
    }
    
    offset += 8 + chunkSize + (chunkSize % 2);
  }
  
  if (!audioLength) {
    throw new Error('Could not find data chunk in WAV');
  }
  
  const rawPcm = inputData.subarray(audioStart, audioStart + audioLength);
  
  // Read duration from WAV or calculate
  const sampleRate = 46875;
  const channels = 1;
  
  // Create TE WAV
  const teWave = await createTEWaveFile(rawPcm, {
    channels,
    sampleRate,
    numSamples: audioLength / 2,
    ...metadata
  });
  
  fs.writeFileSync(outputPath, teWave);
  return teWave;
}

/**
 * Generate SysEx commands to send audio to EP-133
 * Based on analyzing the .syx files from ep_133_sysex_thingy
 */
function buildSysExCommands(wavBuffer, slot, options = {}) {
  const {
    name = 'sample',
    project = 1,
  } = options;
  
  const commands = [];
  
  // 1. INIT command - Setup transfer
  const initCmd = buildInitCommand();
  commands.push(initCmd);
  
  // 2. FILE command - Begins file transfer
  const fileCmd = buildFileCommand(name, slot, wavBuffer.length);
  commands.push(fileCmd);
  
  // 3. DATA commands - Send audio in chunks
  const chunkSize = 240; // Safe chunk size for SysEx
  const chunks = Math.ceil(wavBuffer.length / chunkSize);
  
  for (let i = 0; i < chunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, wavBuffer.length);
    const chunk = wavBuffer.subarray(start, end);
    const dataCmd = buildDataCommand(chunk, i);
    commands.push(dataCmd);
  }
  
  // 4. END command - Finalize transfer
  const endCmd = buildEndCommand(slot);
  commands.push(endCmd);
  
  return commands;
}

function buildInitCommand() {
  // f0 00 20 76 33 40 61 17 01 f7
  const msg = [
    0xf0, ...TE_MANUFACTURER_ID, 0x33, 0x40, 0x61, 0x17, 0x01, 0xf7
  ];
  return Buffer.from(msg);
}

function buildFileCommand(name, slot, size) {
  const nameBuf = Buffer.from(name.padEnd(32, '\0').slice(0, 32), 'ascii');
  
  // Build: f0 00 20 76 33 40 6c 13 [size:5] [slot:3] [name:32] f7
  const header = [
    0xf0, ...TE_MANUFACTURER_ID, 0x33, 0x40, 0x6c, 0x13
  ];
  
  // Size as 5 bytes
  const sizeBytes = [
    (size >> 32) & 0xff,
    (size >> 24) & 0xff,
    (size >> 16) & 0xff,
    (size >> 8) & 0xff,
    size & 0xff,
  ];
  
  // Slot as 3 bytes
  const slotBytes = [
    (slot >> 16) & 0xff,
    (slot >> 8) & 0xff,
    slot & 0xff,
  ];
  
  const footer = [0xf7];
  
  return Buffer.from([...header, ...sizeBytes, ...slotBytes, ...nameBuf, ...footer]);
}

function buildDataCommand(dataChunk, chunkIndex) {
  const header = [
    0xf0, ...TE_MANUFACTURER_ID, 0x33, 0x40  // Command type 40 (DATA)
  ];
  
  // Chunk index as 2 bytes
  const idxBytes = [
    (chunkIndex >> 8) & 0xff,
    chunkIndex & 0xff,
  ];
  
  const footer = [0xf7];
  
  return Buffer.from([...header, ...idxBytes, ...dataChunk, ...footer]);
}

function buildEndCommand(slot) {
  // f0 00 20 76 33 40 60 02 01 00 00 2c 07 p
  const header = [
    0xf0, ...TE_MANUFACTURER_ID, 0x33, 0x40, 0x60, 0x02
  ];
  
  const slotBytes = [
    (slot >> 16) & 0xff,
    (slot >> 8) & 0xff,
    slot & 0xff,
  ];
  
  const footer = [0xf7];
  
  return Buffer.from([...header, ...slotBytes, ...footer]);
}

/**
 * Send audio to EP-133 via MIDI
 */
async function sendAudioToDevice(wavBuffer, slot, options = {}) {
  // This will be called from frontend via Web MIDI API
  // For now, return the commands that need to be sent
  const commands = buildSysExCommands(wavBuffer, slot, options);
  
  // In browser context with jzz, you would do:
  // const port = await jzz().openMidiOut('EP-133');
  // for (const cmd of commands) {
  //   port.send(cmd);
  //   await sleep(10); // Small delay between commands
  // }
  
  return commands;
}

module.exports = {
  buildTEWaveHeader,
  createTEWaveFile,
  convertToTEWave,
  buildSysExCommands,
  sendAudioToDevice,
  DEVICE_SAMPLE_RATE,
};