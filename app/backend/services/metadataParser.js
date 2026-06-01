/**
 * Metadata Parser
 * Extracts BPM, key, and type info from audio filenames
 */

/**
 * Parse metadata from a filename
 * Examples:
 *   "02_LFH_Synth_Loop_120_Dm.wav" → { bpm: 120, key: 'Dm', type: 'loop' }
 *   "AASP_Synth_23_keyCmin_110bpm.wav" → { bpm: 110, key: 'Cmin' }
 *   "FM_Synth_keyC#min_125bpm.wav" → { bpm: 125, key: 'C#min' }
 *   "Kick_Fat_120bpm.wav" → { bpm: 120, type: 'kick' }
 */
function parseFilenameMetadata(filename) {
  const name = filename.replace(/\.[^.]+$/, ''); // strip extension
  const meta = {};

  // Extract BPM
  const bpmMatch = name.match(/[_\s-]?(\d{2,3})\s*bpm/i) ||
                   name.match(/[_\s-](\d{2,3})[_\s-](?:bpm|BPM)?[_\s]/) ||
                   name.match(/[_\s-](\d{2,3})(?:_[A-Ga-g#b])/) ||
                   name.match(/(\d{2,3})(?:BPM|bpm)/);
  if (bpmMatch) {
    const bpm = parseInt(bpmMatch[1], 10);
    if (bpm >= 60 && bpm <= 220) {
      meta.bpm = bpm;
    }
  }

  // Extract key (musical key) - various formats
  const keyPatterns = [
    /key([A-Ga-g][#b]?(?:min|maj|m|M)?)/i,
    /[_\s-]([A-Ga-g][#b]?(?:min|maj|m))[_\s.-]/i,
    /[_\s-]([A-Ga-g][#b]?(?:min|maj|m))$/i,
    /[_\s-]([A-Ga-g][#b]?(?:minor|major))/i,
  ];
  
  for (const pattern of keyPatterns) {
    const match = name.match(pattern);
    if (match) {
      meta.key = normalizeKey(match[1]);
      break;
    }
  }

  // Guess type from filename keywords
  const nameLower = name.toLowerCase();
  if (/kick|kik|kck/.test(nameLower)) meta.guessedType = 'kick';
  else if (/snare|snr|clap/.test(nameLower)) meta.guessedType = 'snare';
  else if (/hat|hh|cymbal|ride|crash/.test(nameLower)) meta.guessedType = 'cymbal';
  else if (/perc|cowbell|agogo|bongo|conga|shaker|tamb/.test(nameLower)) meta.guessedType = 'perc';
  else if (/bass|808|sub/.test(nameLower)) meta.guessedType = 'bass';
  else if (/synth|lead|melody|chord|arp|piano|key/.test(nameLower)) meta.guessedType = 'melody';
  else if (/loop|drum/.test(nameLower)) meta.guessedType = 'loop';
  else if (/vocal|vox|voice|rap|hook/.test(nameLower)) meta.guessedType = 'loop';
  else if (/fx|sfx|riser|sweep|impact|trans/.test(nameLower)) meta.guessedType = 'sfx';

  // Detect loop vs one-shot from filename
  if (/loop|lp_|_lp/.test(nameLower)) meta.isLoop = true;
  if (/one.?shot|oneshot|one_shot/.test(nameLower)) meta.isLoop = false;

  return meta;
}

/**
 * Normalize key name
 */
function normalizeKey(key) {
  if (!key) return null;
  // Normalize common variants
  key = key
    .replace(/minor/i, 'min')
    .replace(/major/i, 'maj')
    .replace(/maj$/i, '')
    .replace(/^([A-Ga-g])([#b]?)(min|m)$/i, (_, note, acc, mod) => 
      note.toUpperCase() + acc + 'min'
    )
    .replace(/^([A-Ga-g])([#b]?)$/i, (_, note, acc) => 
      note.toUpperCase() + acc
    );
  return key;
}

module.exports = { parseFilenameMetadata, normalizeKey };
