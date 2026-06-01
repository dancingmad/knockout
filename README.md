# Knockout — K.O. II Song Workflow

A Node.js web application for building songs on the **Teenage Engineering K.O. II (EP-133)** sampler. Knockout replaces the limited browser-based ep-sample-tool with a full offline workflow: browse your sample library, plan slot assignments, build pad layouts, optimize audio, and export a ready-to-load `.ppak` project file.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Setup](#setup)
4. [The Four-Step Workflow](#the-four-step-workflow)
   - [Step 1 — Sample Library](#step-1--sample-library)
   - [Step 2 — Song Builder](#step-2--song-builder)
   - [Step 3 — Pad Editor](#step-3--pad-editor)
   - [Step 4 — Import / Export](#step-4--import--export)
5. [Uploading to the Device](#uploading-to-the-device)
6. [Slot Categories Reference](#slot-categories-reference)
7. [ppak File Format](#ppak-file-format)
8. [API Reference](#api-reference)
9. [Device Audio Specs](#device-audio-specs)
10. [Known Limitations](#known-limitations)

---

## Overview

The K.O. II supports 999 sample slots and 4 × 12 performance pads (groups A, B, C, D). The official web tool at [teenage.engineering/apps/ep-sample-tool](https://teenage.engineering/apps/ep-sample-tool) allows uploading samples and doing basic pad assignment, but requires a live USB connection and offers no project management.

**Knockout** solves this by letting you:

- 📂 **Browse** your local sample folders and see BPM, key, and type extracted from filenames
- 🎛️ **Plan** which sample goes in which slot (kick in 1–99, snare in 100–199, etc.)
- 🎹 **Design** your pad layout for all four groups (A/B/C/D × 12 pads) before touching the device
- ⚙️ **Optimize** samples to the exact device format (46875 Hz, 16-bit PCM, mono for drums)
- 📦 **Export** a valid `.ppak` project archive readable by the ep-sample-tool
- 📥 **Import** any existing `.ppak` backup from the device to inspect or continue editing

---

## Architecture

```
knockout/
├── app/
│   ├── backend/                  Express REST API (port 3001)
│   │   ├── server.js
│   │   ├── routes/
│   │   │   ├── samples.js        Sample library API
│   │   │   ├── projects.js       Project CRUD + pad assignment
│   │   │   ├── export.js         ppak file generation
│   │   │   ├── import.js         ppak file parsing
│   │   │   └── audio.js          FFmpeg conversion & streaming
│   │   └── services/
│   │       ├── sampleLibrary.js  Folder scanner + metadata extractor
│   │       ├── metadataParser.js BPM / key / type from filenames
│   │       ├── ppakBuilder.js    Build valid .ppak ZIP archives
│   │       ├── ppakParser.js     Parse existing .ppak files
│   │       ├── audioProcessor.js FFmpeg wrapper (convert, optimize)
│   │       └── projectStorage.js JSON project files on disk
│   └── frontend/                 React + Ant Design (port 3002)
│       └── src/
│           ├── pages/
│           │   ├── LibraryPage.jsx     Sample browser + preview
│           │   ├── SongBuilderPage.jsx Slot assignment grid
│           │   ├── PadEditorPage.jsx   KO II pad layout editor
│           │   └── ImportExportPage.jsx ppak import/export
│           ├── store/index.js    Zustand global state
│           └── utils/
│               ├── api.js        Axios API client
│               └── ko2.js        KO II constants & helpers
├── .knockout/                    App data (auto-created)
│   ├── projects/                 Saved project JSON files
│   ├── optimized/                FFmpeg-converted sample cache
│   └── imports/                  Sounds extracted from ppak imports
├── Drift Phonk/                  ← Your sample sets live here
│   ├── Loop/
│   └── One_Shot/
├── LofiSynth/
├── project-backups/              KO II backup .ppak files
└── KO2.md                        Device specification reference
```

Projects are saved as plain JSON files in `.knockout/projects/` — no database required.

---

## Setup

### Prerequisites

- **Node.js** v18+
- **FFmpeg** installed and on `$PATH` (required for audio optimization)
  ```bash
  brew install ffmpeg          # macOS
  sudo apt install ffmpeg      # Ubuntu/Debian
  ```

### Install

```bash
# Backend
cd app/backend
npm install

# Frontend
cd app/frontend
npm install
```

### Run

Open two terminals (or use a process manager):

```bash
# Terminal 1 — Backend
cd app/backend
LIBRARY_ROOT=/path/to/knockout node server.js
# → http://localhost:3001

# Terminal 2 — Frontend
cd app/frontend
npm run dev
# → http://localhost:3002
```

`LIBRARY_ROOT` defaults to `../../` (the repo root), so all sample folders at the repo level are automatically discovered.

Open **http://localhost:3002** in your browser.

---

## The Four-Step Workflow

### Step 1 — Sample Library

**Tab: Sample Library**

The library scanner automatically reads every subfolder inside `LIBRARY_ROOT` as a **Sample Set**. Audio files (`.wav`, `.mp3`, `.aiff`, `.flac`, `.ogg`) are scanned recursively. Metadata is extracted from filenames without needing a database.

#### Filename Metadata Extraction

| Pattern in filename | Extracted field |
|---|---|
| `120bpm`, `120BPM`, `_120_` | BPM |
| `keyCmin`, `_Cmin_`, `_F#m_` | Musical key |
| `kick`, `kik`, `snr`, `hat` | Guessed type |
| `loop`, `_lp_` | Loop flag |
| `one_shot`, `oneshot` | One-shot flag |

**Examples:**
```
02_LFH_Synth_Loop_120_Dm.wav        → BPM: 120, Key: Dm, Loop
AASP_Synth_23_keyCmin_110bpm.wav    → BPM: 110, Key: Cmin
RS_BF_Noche_One_Shot_Kick_1.wav     → Type: Kick, One-shot
```

#### Category auto-detection from folder path

Folder names are matched to slot categories:

| Folder name | Slot category |
|---|---|
| `Drums`, `Kick`, `Kicks` | KICK (1–99) |
| `Snare`, `Snares` | SNARE (100–199) |
| `Cymbal`, `Hat`, `Hihat` | CYMB (200–299) |
| `Perc`, `Percussion` | PERC (300–399) |
| `Bass` | BASS (400–499) |
| `Synth`, `Melody`, `Lead` | MELOD (500–599) |
| `Loop`, `Vocal`, `Vox` | LOOP (600–699) |
| `Fx`, `Sfx`, `Effects` | SFX (900–999) |

#### Usage

1. Select a **Sample Set** from the dropdown (or view all)
2. Filter by **Category** or use the **Search** box
3. Click any sample to open the **Preview Panel** — it loads the waveform and shows metadata
4. Click **▶ Play** to audition the sample
5. Click **+ Add to Project** to assign it to a slot in the current project

---

### Step 2 — Song Builder

**Tab: Song Builder**

The Song Builder manages the 999 sample slots. Slots are organized into the same categories as the device:

| Category | Slots | Typical use |
|---|---|---|
| KICK | 1–99 | Kick drums, bass drums |
| SNARE | 100–199 | Snares, claps, rimshots |
| CYMB | 200–299 | Hi-hats, cymbals, rides |
| PERC | 300–399 | Percussion, cowbells, shakers |
| BASS | 400–499 | 808s, bass one-shots |
| MELOD | 500–599 | Synth one-shots, leads |
| LOOP | 600–699 | Drum loops, vocal loops, synth loops |
| USER 1 | 700–799 | Anything else |
| USER 2 | 800–899 | Anything else |
| SFX | 900–999 | FX, risers, impacts |

#### Creating a project

1. Click **+ New** → enter name, BPM, key, description
2. A new project is created and auto-selected

#### Assigning samples to slots

- **From the Library tab:** select a sample → click **Add to Project** → choose slot number (auto-suggested from category)
- **Via API:** `POST /api/projects/:id/sounds` with `{ slot, name, filename, originalPath, category }`

The slot grid shows:
- Empty slots as dark cells
- Occupied slots with a **colored top bar** (category color), sample name, and BPM
- Clicking an occupied slot opens the **Sound Detail** panel (right sidebar) with waveform preview

#### Removing a sample

Click the **🗑** icon on any slot cell → confirm removal. This also clears any pad assignments using that slot.

#### Exporting

Click **Export ppak** (top right) to download the project as a `.ppak` file ready to load on the device. See [Step 4](#step-4--import--export) for optimization before export.

---

### Step 3 — Pad Editor

**Tab: Pad Editor**

The Pad Editor shows a visual representation of the K.O. II's 4 × 12 pad layout. Each of the four groups (A, B, C, D) has 12 pads arranged in the same physical layout as the device:

```
Row 4:  10  11  12
Row 3:   7   8   9
Row 2:   4   5   6
Row 1:   1   2   3
```

#### Assigning a sound to a pad

1. Select a project
2. Click a **group tab** (A / B / C / D) to switch groups
3. Click any **pad** — it highlights in the group's color
4. In the **Sound Picker** panel (right), select which slot to assign
5. The pad immediately updates to show the sample name

#### Per-pad settings

Each pad can be configured independently:

| Setting | Description |
|---|---|
| **Volume** | 0–100, default 100 |
| **Root Note** | MIDI note for pitch reference, default C4 (60) |
| **IN Point** | Trim start in samples at 46875 Hz (0 = from start) |
| **OUT Point** | Trim end in samples (0 = play to end) |
| **Loop Mode** | Toggle loop playback on/off |

Click **Save** to persist. The binary pad config is written into the exported `.ppak`.

#### All Groups Overview

The bottom section shows all four groups at a glance — a mini dot-grid shows which of the 12 pads in each group are assigned.

---

### Step 4 — Import / Export

**Tab: Import / Export**

#### Export a project as `.ppak`

1. All projects are listed with their sound count and pad count
2. Click **Export** next to a project
3. The browser downloads `{ProjectName}_P01_backup.ppak`
4. Load this file into the ep-sample-tool via **BACKUP & RESTORE → Restore**

#### Optimize samples before export

The K.O. II requires audio at exactly **46875 Hz, 16-bit signed PCM**. Click **⚡ Optimize All Samples** to run FFmpeg on all project sounds:

- **Drums / Percussion / SFX** → converted to **mono** (saves memory)
- **Bass / Melody / Loop** → kept **stereo**
- All samples resampled to **46875 Hz, 16-bit**

Results show per-slot success/failure. Optimized files are cached in `.knockout/optimized/` — re-optimization is skipped unless forced.

> ⚠️ **Always optimize before export** if your source samples are not already 46875 Hz 16-bit WAV. The device will reject or misplay samples in other formats.

#### Import an existing `.ppak`

1. Drop a `.ppak` backup file onto the import panel
2. A **preview** shows all sounds (slot, name, size) and pad assignment count
3. Enter a project name and click **Import Project**
4. The project appears in Song Builder and Pad Editor with all assignments intact
5. Sounds are extracted to `.knockout/imports/{project-name}/`

---

## Uploading to the Device

Knockout generates `.ppak` files that are loaded via the official ep-sample-tool. Direct USB MIDI upload is not yet implemented (see [Known Limitations](#known-limitations)).

### Steps

1. Connect your K.O. II via USB-C to your computer
2. Open [https://teenage.engineering/apps/ep-sample-tool](https://teenage.engineering/apps/ep-sample-tool) in Chrome
3. Click **BACKUP & RESTORE** (bottom right of the tool)
4. Click **Restore from file**
5. Select your exported `.ppak` file
6. Wait for the upload to complete (~30–60 seconds depending on file size)
7. The device reboots and your sounds + pad layout are loaded

> 💡 **Tip:** Back up your current device state first using the **Backup** button in the ep-sample-tool before restoring a new project.

---

## Slot Categories Reference

The K.O. II assigns meaning to slot ranges. Knockout enforces the same organization:

| Label | Slots | Max samples | Notes |
|---|---|---|---|
| KICK | 1–99 | 99 | Kick drums — mono recommended |
| SNARE | 100–199 | 100 | Snares, claps — mono recommended |
| CYMB | 200–299 | 100 | Hi-hats, cymbals — mono recommended |
| PERC | 300–399 | 100 | Percussion — mono recommended |
| BASS | 400–499 | 100 | Bass, 808s — stereo or mono |
| MELOD | 500–599 | 100 | Melodic one-shots — stereo |
| LOOP | 600–699 | 100 | Loops — stereo |
| USER 1 | 700–799 | 100 | Free use |
| USER 2 | 800–899 | 100 | Free use |
| SFX | 900–999 | 100 | Effects — mono recommended |

The device has **128 MB** of sample memory total and supports up to **12 stereo** or **16 mono** simultaneous voices.

---

## ppak File Format

The `.ppak` format was reverse-engineered from device backups. It is a standard **ZIP archive** containing:

```
backup.ppak (ZIP)
├── meta.json                  Device and format metadata
├── sounds/
│   ├── 001 kick drum.wav      Slot 1 → "kick drum"
│   ├── 110 snare fat.wav      Slot 110 → "snare fat"
│   └── ...                    Named as "{slot:03d} {name}.wav"
└── projects/
    └── P01.tar                TAR archive for project slot 1
        ├── pads/
        │   ├── a/p01 … p12   Binary pad config (26 bytes each)
        │   ├── b/p01 … p12
        │   ├── c/p01 … p12
        │   └── d/p01 … p12
        ├── patterns/          Pattern data (binary)
        ├── scenes             Scene assignments (binary)
        ├── settings           Global settings (binary)
        └── fx_settings        FX settings (binary)
```

### Pad binary format (26 bytes, little-endian)

| Offset | Size | Type | Field | Notes |
|---|---|---|---|---|
| 0 | 1 | uint8 | mode | Always `0x00` |
| 1 | 2 | uint16 LE | **slot** | Sample slot (1–999), `0` = empty |
| 3 | 1 | uint8 | padding | `0x00` |
| 4 | 4 | uint32 LE | **inPoint** | Trim start in samples at 46875 Hz |
| 8 | 4 | uint32 LE | **outPoint** | Trim end in samples (`0` = play to end) |
| 12 | 4 | float32 LE | **bpm** | Sample BPM (`0.0` or `120.0` = default) |
| 16 | 2 | uint16 LE | **volume** | 0–100, default `100` |
| 18 | 2 | uint16 LE | reserved | `0x0000` |
| 20 | 1 | uint8 | **flags** | Playback flags, `0xFF` = default |
| 21 | 1 | uint8 | reserved | `0x00` |
| 22 | 2 | uint16 LE | **loopFlag** | `1` = loop, `0` = one-shot |
| 24 | 1 | uint8 | **rootNote** | MIDI note, `0x3C` = C4 |
| 25 | 1 | uint8 | padding | `0x00` |

### meta.json schema

```json
{
  "info": "teenage engineering - pak file",
  "pak_version": 1,
  "pak_type": "project",
  "pak_release": "1.2.0",
  "device_name": "EP-133",
  "device_sku": "TE032AS001",
  "device_version": "2.0.5",
  "generated_at": "<ISO timestamp>",
  "author": "knockout"
}
```

---

## API Reference

The backend runs on **http://localhost:3001**.

### Samples

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/samples/sets` | List all sample set folders |
| `GET` | `/api/samples/sets/:setId` | Get all samples in a set |
| `GET` | `/api/samples` | Get all samples (`?category=kick&search=fat&setId=x`) |
| `GET` | `/api/samples/categories` | Get slot category definitions |
| `GET` | `/api/samples/meta?filePath=…` | Get audio metadata via ffprobe |

### Projects

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/projects` | List all projects |
| `GET` | `/api/projects/:id` | Get a project |
| `POST` | `/api/projects` | Create project (`{ name, bpm, key, description }`) |
| `PUT` | `/api/projects/:id` | Update project |
| `DELETE` | `/api/projects/:id` | Delete project |
| `POST` | `/api/projects/:id/sounds` | Add sound (`{ slot, name, filename, originalPath, category }`) |
| `DELETE` | `/api/projects/:id/sounds/:slot` | Remove sound from slot |
| `PUT` | `/api/projects/:id/pads` | Replace all pad assignments |
| `PUT` | `/api/projects/:id/pads/:group/:pad` | Update single pad config |

### Export / Import

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/export/:id` | Download project as `.ppak` |
| `GET` | `/api/export/:id/preview` | Preview export stats (no download) |
| `POST` | `/api/import/ppak` | Import a `.ppak` file (multipart) |
| `POST` | `/api/import/ppak/preview` | Preview a `.ppak` without importing |

### Audio

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/audio/meta?filePath=…` | ffprobe metadata for a file |
| `POST` | `/api/audio/optimize` | Convert one file to device format |
| `POST` | `/api/audio/optimize-project/:id` | Optimize all sounds in a project |
| `GET` | `/api/audio/stream?filePath=…` | Stream audio for browser playback (range support) |

Static files in `LIBRARY_ROOT` are served under `/library/`.

---

## Device Audio Specs

| Spec | Value |
|---|---|
| Sample rate | **46,875 Hz** |
| Bit depth | **16-bit signed PCM** |
| Channels | 1 (mono) or 2 (stereo) |
| Max sample length | 20 seconds |
| Max memory | 128 MB |
| Polyphony | 12 stereo voices or 16 mono voices |
| Device connection | USB-C (MIDI + file transfer) |

The device communicates over **USB MIDI SysEx** (command `TE_SYSEX_FILE = 5`) for file transfers. This is what the ep-sample-tool uses internally.

---

## Known Limitations

- **Direct USB upload not yet implemented.** Export produces a valid `.ppak` that must be loaded via the ep-sample-tool's Backup & Restore feature. Direct WebMIDI/SysEx upload is planned.
- **Pattern editing not supported.** Pattern/sequence data is preserved from imports but cannot be created or edited yet. The KO II MIDI reference is at [teenage.engineering/guides/ep-133/system](https://teenage.engineering/guides/ep-133/system#14.1-midi-refrence).
- **Only project slot P01** is supported for export. The device supports P01–P99 but most workflows use P01.
- **Channels/Rate in preview panel** show `—` until the `/api/audio/meta` endpoint is called (lazy-loaded; planned improvement).
- **20-second sample limit.** The device rejects samples longer than 20 seconds. The optimizer does not yet auto-trim — trim manually or use the IN/OUT point fields in the Pad Editor.
