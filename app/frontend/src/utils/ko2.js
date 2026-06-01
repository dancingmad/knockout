// KO II slot category definitions
export const SLOT_CATEGORIES = [
  { id: 'kick',   label: 'KICK',   range: [1, 99],    color: '#ff4444', darkColor: '#5a1010' },
  { id: 'snare',  label: 'SNARE',  range: [100, 199], color: '#ff8c44', darkColor: '#5a2810' },
  { id: 'cymbal', label: 'CYMB',   range: [200, 299], color: '#ffd44a', darkColor: '#4a3c10' },
  { id: 'perc',   label: 'PERC',   range: [300, 399], color: '#8bc34a', darkColor: '#2a3c10' },
  { id: 'bass',   label: 'BASS',   range: [400, 499], color: '#42a5f5', darkColor: '#10305a' },
  { id: 'melody', label: 'MELOD',  range: [500, 599], color: '#ab47bc', darkColor: '#38104a' },
  { id: 'loop',   label: 'LOOP',   range: [600, 699], color: '#26c6da', darkColor: '#103a42' },
  { id: 'user1',  label: 'USER 1', range: [700, 799], color: '#78909c', darkColor: '#20303a' },
  { id: 'user2',  label: 'USER 2', range: [800, 899], color: '#a1887f', darkColor: '#302010' },
  { id: 'sfx',    label: 'SFX',    range: [900, 999], color: '#ef5350', darkColor: '#5a1010' },
];

export function getCategoryForSlot(slot) {
  for (const cat of SLOT_CATEGORIES) {
    if (slot >= cat.range[0] && slot <= cat.range[1]) return cat;
  }
  return SLOT_CATEGORIES[6]; // user1 as fallback
}

export function getCategoryById(id) {
  return SLOT_CATEGORIES.find(c => c.id === id) || SLOT_CATEGORIES[6];
}

export function getNextFreeSlot(usedSlots, categoryId) {
  const cat = getCategoryById(categoryId);
  if (!cat) return null;
  for (let slot = cat.range[0]; slot <= cat.range[1]; slot++) {
    if (!usedSlots.includes(slot)) return slot;
  }
  return null;
}

// Group definitions  
export const PAD_GROUPS = [
  { id: 'a', label: 'A', color: '#d32f2f', pads: 12 },
  { id: 'b', label: 'B', color: '#1565c0', pads: 12 },
  { id: 'c', label: 'C', color: '#2e7d32', pads: 12 },
  { id: 'd', label: 'D', color: '#e65100', pads: 12 },
];

// Format duration in seconds
export function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '0.0s';
  if (seconds < 1) return `${(seconds * 1000).toFixed(0)}ms`;
  return `${seconds.toFixed(1)}s`;
}

// Format file size
export function formatSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Format BPM
export function formatBpm(bpm) {
  if (!bpm || bpm === 0) return '—';
  return `${Math.round(bpm)} BPM`;
}

// MIDI note to name
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export function midiNoteToName(note) {
  const octave = Math.floor(note / 12) - 1;
  const name = NOTE_NAMES[note % 12];
  return `${name}${octave}`;
}

// Download a blob as file
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
