# Knockout — K.O. II Song Workflow

A Node.js web application for building songs on the **Teenage Engineering K.O. II (EP-133)** sampler. 

## Quick Start

```bash
# Install dependencies
npm install
cd app/backend && npm install
cd ../frontend && npm install

# Development mode (runs both frontend and backend)
npm run dev

# Or run separately:
npm run dev:backend   # API server on http://localhost:3001
npm run dev:frontend  # Vite dev server on http://localhost:5173

# Production build & run
npm run build         # Build frontend to app/frontend/dist
npm run start         # Server with built frontend

# Or in one command:
npm run server        # Build + start
```

## Environment

Copy `.env` to customize:
- `PORT` - Server port (default: 3001)
- `NODE_ENV` - development or production
- `LIBRARY_ROOT` - Where your sample files are stored

## Data Persistence

All project data is stored in `.knockout/` folder:
- `.knockout/projects/` - Saved projects (JSON)
- `.knockout/optimized/` - Converted audio files
- `.knockout/imports/` - Extracted sounds from imports

This data **persists between restarts**.

## Features

- 📂 **Sample Library** - Browse audio files with metadata extraction
- 🎛 **Song Builder** - Assign samples to 999 slots
- 🎹 **Pad Editor** - Design 4×12 pad layouts  
- 🎵 **Sequencer** - Visual step sequencer editor
- 📦 **Export** - Generate .ppak files
- 🔌 **Direct Upload** - Send sounds via SysEx (coming soon)

## Tech Stack

- Backend: Node.js + Express + FFmpeg
- Frontend: React + Ant Design + Zustand
- Audio: FFmpeg for conversion

## Architecture

```
knockout/
├── app/
│   ├── backend/       # Express API (port 3001)
│   └── frontend/      # React + Vite (port 5173 in dev)
├── .knockout/         # Data persistence (projects, optimized audio)
├── package.json       # Root scripts
└── .env              # Environment config
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Run both frontend and backend |
| `npm run dev:backend` | Backend only |
| `npm run dev:frontend` | Frontend only |
| `npm run build` | Build frontend |
| `npm run start` | Production server |
| `npm run server` | Build + start |

## Known Issues

- Direct SysEx upload is planned but not yet implemented
- Pattern/sequence editing is for visualization only
