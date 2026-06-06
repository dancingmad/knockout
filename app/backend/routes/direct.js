/**
 * Direct Upload API Routes
 * Send audio directly to EP-133 via SysEx commands
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const {
  buildTEWaveHeader,
  createTEWaveFile,
  buildSysExCommands,
  DEVICE_SAMPLE_RATE
} = require('../services/sysexUploader');
const { getAudioMetadata, optimizeSample, convertAudio } = require('../services/audioProcessor');
const { getProject, saveProject, getOptimizedPath } = require('../services/projectStorage');
const { LIBRARY_ROOT } = require('../services/sampleLibrary');

// GET /api/direct/sample-slots - List available sample slots on device
// (This is metadata for the UI - actual slots are 1-999)
router.get('/sample-slots', (req, res) => {
  const slots = [];
  const ranges = [
    { name: 'Kick', start: 1, end: 99 },
    { name: 'Snare', start: 100, end: 199 },
    { name: 'Cymbal', start: 200, end: 299 },
    { name: 'Percussion', start: 300, end: 399 },
    { name: 'Bass', start: 400, end: 499 },
    { name: 'Melody', start: 500, end: 599 },
    { name: 'Loop', start: 600, end: 699 },
    { name: 'User 1', start: 700, end: 799 },
    { name: 'User 2', start: 800, end: 899 },
    { name: 'SFX', start: 900, end: 999 },
  ];
  
  for (const range of ranges) {
    for (let i = range.start; i <= range.end; i++) {
      slots.push({ slot: i, name: range.name, category: range.name.toLowerCase() });
    }
  }
  
  res.json(slots);
});

// POST /api/direct/prepare-audio - Prepare audio with TE header for upload
router.post('/prepare-audio', async (req, res) => {
  try {
    const { sound } = req.body;
    if (!sound || !sound.filePath) {
      return res.status(400).json({ error: 'sound.filePath is required' });
    }
    
    const fullPath = path.isAbsolute(sound.filePath) 
      ? sound.filePath 
      : path.join(LIBRARY_ROOT, sound.filePath);
    
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Read and process audio
    // First ensure it's optimized to 46875 Hz 16-bit PCM
    const metadata = await getAudioMetadata(fullPath);
    if (!metadata) {
      return res.status(500).json({ error: 'Could not read audio metadata' });
    }
    
    // Check if already in correct format
    const needsConversion = metadata.sampleRate !== DEVICE_SAMPLE_RATE || metadata.bitDepth !== 16;
    
    // Prepare TE metadata
    const teMeta = {
      sampleRate: DEVICE_SAMPLE_RATE,
      channels: sound.category && ['kick', 'snare', 'cymbal', 'perc', 'sfx'].includes(sound.category) ? 1 : 2,
      playmode: sound.isLoop ? 'loop' : 'oneshot',
      rootNote: sound.rootNote || 60,
      pitch: sound.pitch || 0,
      pan: sound.pan || 0,
      amplitude: sound.volume || 100,
      attack: 0,
      release: 255,
    };
    
    // Get raw PCM data from original file (we'd need to convert if not already)
    // For now, return the metadata needed
    res.json({
      success: true,
      needsConversion,
      metadata: {
        originalSampleRate: metadata.sampleRate,
        originalChannels: metadata.channels,
        originalBitDepth: metadata.bitDepth,
        duration: metadata.duration,
      },
      teMetadata: teMeta,
      slot: sound.slot,
    });
    
  } catch (err) {
    console.error('Prepare audio error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/direct/get-sysex-commands - Get SysEx commands for a sound
router.post('/get-sysex-commands', async (req, res) => {
  try {
    const { sound, slot, name } = req.body;
    
    if (!sound || !sound.filePath) {
      return res.status(400).json({ error: 'sound.filePath is required' });
    }
    
    const fullPath = path.isAbsolute(sound.filePath) 
      ? sound.filePath 
      : path.join(LIBRARY_ROOT, sound.filePath);
    
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // For now, we'll return the base64-encoded commands
    // The frontend will use Web MIDI + jzz to send these
    
    // In reality, we need to:
    // 1. Read the audio file
    // 2. If not 46875 Hz, resample it
    // 3. Extract raw PCM
    // 4. Add TE header
    // 5. Build SysEx commands
    
    // Let's return a placeholder with instructions
    res.json({
      success: true,
      slot: slot || sound.slot || 1,
      name: name || sound.name || 'sample',
      message: 'SysEx commands would be built here after audio conversion',
      // In full implementation, return base64 encoded commands:
      // commands: commands.map(c => c.toString('base64'))
    });
    
  } catch (err) {
    console.error('Get sysex commands error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/direct/test-midi - Test MIDI connectivity
router.get('/test-midi', (req, res) => {
  // This endpoint just confirms API is working
  // Actual MIDI testing happens in browser with jzz
  res.json({
    status: 'ok',
    message: 'Direct upload API is ready. Use Web MIDI in browser to send commands.',
    sampleRate: DEVICE_SAMPLE_RATE,
  });
});

// GET /api/direct/wave-header-example - Get example of TE wave header
router.get('/wave-header-example', (req, res) => {
  const header = buildTEWaveHeader({
    sampleRate: DEVICE_SAMPLE_RATE,
    channels: 1,
    playmode: 'oneshot',
    rootNote: 60,
    amplitude: 100,
  });
  
  res.set('Content-Type', 'application/octet-stream');
  res.set('Content-Disposition', 'attachment; filename=te_header_example.bin');
  res.send(header);
});

module.exports = router;