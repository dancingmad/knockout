/**
 * Audio Processor Service
 * Converts audio files to KO II compatible format (46875 Hz, 16-bit PCM)
 * Uses FFmpeg for conversion
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const DEVICE_SAMPLE_RATE = 46875;
const DEVICE_BIT_DEPTH = 16;

/**
 * Get audio file metadata using ffprobe
 */
async function getAudioMetadata(filePath) {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v quiet -print_format json -show_streams -show_format "${filePath}"`
    );
    const data = JSON.parse(stdout);
    const audioStream = data.streams?.find(s => s.codec_type === 'audio');
    
    if (!audioStream) {
      throw new Error('No audio stream found');
    }
    
    const format = data.format;
    const duration = parseFloat(format?.duration || audioStream?.duration || 0);
    const sampleRate = parseInt(audioStream.sample_rate || 0, 10);
    const channels = audioStream.channels || 1;
    const bitDepth = audioStream.bits_per_sample || audioStream.bits_per_raw_sample || 16;
    const codec = audioStream.codec_name || 'unknown';
    const size = parseInt(format?.size || 0, 10);
    
    return {
      duration,
      sampleRate,
      channels,
      bitDepth,
      codec,
      size,
      durationSamples: Math.round(duration * sampleRate),
      isCompatible: (
        sampleRate === DEVICE_SAMPLE_RATE &&
        bitDepth === DEVICE_BIT_DEPTH &&
        (channels === 1 || channels === 2)
      ),
    };
  } catch (err) {
    console.error('ffprobe error:', err.message);
    return null;
  }
}

/**
 * Convert an audio file to KO II compatible format
 * 
 * @param {string} inputPath - Source audio file
 * @param {string} outputPath - Output WAV file path
 * @param {Object} options
 * @param {boolean} options.mono - Force mono (for drums/fx)
 * @param {boolean} options.stereo - Force stereo (for loops/melody)
 * @param {number} options.trimStart - Start time in seconds
 * @param {number} options.trimEnd - End time in seconds
 * @param {number} options.normalize - Target normalization level (dBFS, e.g. -1)
 */
async function convertAudio(inputPath, outputPath, options = {}) {
  const {
    mono = false,
    stereo = false,
    trimStart = null,
    trimEnd = null,
    normalize = null,
  } = options;
  
  const filters = [];
  let inputArgs = '';
  let outputArgs = '';
  
  // Trim
  if (trimStart !== null) {
    inputArgs += ` -ss ${trimStart}`;
  }
  if (trimEnd !== null) {
    const duration = trimEnd - (trimStart || 0);
    inputArgs += ` -t ${duration}`;
  }
  
  // Channel conversion
  if (mono) {
    filters.push('pan=mono|c0=0.5*c0+0.5*c1');
  } else if (stereo) {
    // No filter needed - pass through as stereo
  }
  
  // Normalization
  if (normalize !== null) {
    filters.push(`loudnorm=I=-16:TP=${normalize}:LRA=11`);
  }
  
  const filterArg = filters.length > 0 ? `-af "${filters.join(',')}"` : '';
  
  // Output format: WAV, 46875 Hz, 16-bit PCM
  outputArgs = `-ar ${DEVICE_SAMPLE_RATE} -acodec pcm_s16le`;
  
  const cmd = `ffmpeg -y${inputArgs} -i "${inputPath}" ${filterArg} ${outputArgs} "${outputPath}"`;
  
  try {
    await execAsync(cmd);
    const stats = fs.statSync(outputPath);
    return {
      success: true,
      outputPath,
      size: stats.size,
    };
  } catch (err) {
    throw new Error(`FFmpeg conversion failed: ${err.message}`);
  }
}

/**
 * Optimize a sample for the KO II device
 * - Converts to 46875 Hz, 16-bit PCM
 * - Mono for drums/fx, stereo for melody/loops
 * - Trims silence from start/end
 * - Normalizes level
 */
async function optimizeSample(inputPath, outputPath, category, options = {}) {
  const drumCategories = ['kick', 'snare', 'cymbal', 'perc', 'sfx'];
  const shouldBeMono = drumCategories.includes(category);
  
  return convertAudio(inputPath, outputPath, {
    mono: shouldBeMono && !options.keepStereo,
    stereo: !shouldBeMono || options.keepStereo,
    ...options,
  });
}

/**
 * Get the duration in samples at device sample rate
 */
async function getDurationInDeviceSamples(filePath) {
  const meta = await getAudioMetadata(filePath);
  if (!meta) return 0;
  return Math.round(meta.duration * DEVICE_SAMPLE_RATE);
}

module.exports = {
  getAudioMetadata,
  convertAudio,
  optimizeSample,
  getDurationInDeviceSamples,
  DEVICE_SAMPLE_RATE,
  DEVICE_BIT_DEPTH,
};
