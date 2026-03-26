# CanvasTool

Desktop reference board scaffold for `Windows` and `macOS` using `Electron + React + TypeScript + PixiJS`.

## Stack

- `Electron`: desktop shell, file APIs, native integrations
- `React`: app shell, panels, dialogs, settings UI
- `PixiJS`: high-performance canvas scene for references and overlays
- `TypeScript`: one language for main, preload, and renderer
- `Vite`: renderer bundling and dev server
- `esbuild`: fast bundling for Electron main and preload

## Prerequisites

- `Node.js 20+`
- `npm 10+`
- `macOS` machine to produce `.dmg`
- `Windows` machine to fully validate `.exe` installer behavior

## Install

```bash
npm install
```

## Development

```bash
npm run dev
```

This starts:

- Vite dev server for the React renderer
- esbuild watch for `src/main`
- esbuild watch for `src/preload`
- Electron pointed at the Vite dev server

## Production Build

```bash
npm run build
```

Output:

- renderer bundle: `dist/renderer`
- Electron main bundle: `dist/main`
- preload bundle: `dist/preload`

## Package Installers

```bash
npm run package
```

Targets:

- Windows: `NSIS .exe`
- macOS: `.dmg`

Important notices:

- `.dmg` builds should be created on `macOS`
- macOS distribution will eventually need code signing and notarization
- screen/window capture on macOS requires Screen Recording permission
- renderer must not access Node.js directly

## Architecture

- `src/main`
  - local desktop backend
  - owns BrowserWindow, IPC, file dialogs, native integrations
- `src/preload`
  - secure bridge using `contextBridge`
- `src/renderer`
  - React UI and Pixi scene
- `src/shared`
  - shared types and constants

## Security Baseline

Current scaffold already uses:

- `contextIsolation: true`
- `nodeIntegration: false`

Keep all privileged operations in the main process and expose only narrow APIs through preload.

## Current MVP Foundation

- secure preload bridge with typed IPC contracts
- project create/open/save/save-as with zip-based `.canvas` container
- recent files persistence and dynamic window title updates
- Pixi board interaction (pan, zoom, select, drag, flip)
- per-group viewport state and instant group switching
- task/to-do panel with create, edit, toggle, drag reorder

## Next Build Steps

1. Add image import (file drop, clipboard, web source parsing)
2. Replace placeholder item blocks with texture-backed images and lazy loading
3. Add annotation layer with doodle tools and undo/redo command history
4. Implement filters, layout modes, and fit-to-content flow
5. Add capture flow, ACO export, and packaging signing/notarization config
