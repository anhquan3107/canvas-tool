# Setup Guide

## Goal

This project uses one language and one runtime model:

- `TypeScript` for all code
- `Electron` as the desktop framework
- `React` for application UI
- `PixiJS` for the interactive board/canvas

There is no separate web backend in v1. The local backend is the Electron main process.

## Runtime Model

The app is split into three parts:

### Main Process

Location:

- `src/main`

Responsibilities:

- create native windows
- handle dialogs, filesystem, clipboard, menus, recent files
- own IPC handlers
- later own project persistence, capture, export, and ACO generation

Language:

- `TypeScript`

### Preload

Location:

- `src/preload`

Responsibilities:

- expose a small safe API from Electron to the renderer
- prevent direct Node.js usage inside React

Language:

- `TypeScript`

### Renderer

Location:

- `src/renderer`

Responsibilities:

- render app panels and settings with React
- render the reference board with PixiJS

Language:

- `TypeScript`

## Why This Build Setup

This scaffold uses:

- `Vite` for the renderer because React development is fast and stable
- `esbuild` for Electron main/preload because those bundles are small and startup should stay fast
- `electron-builder` for packaging `.exe` and `.dmg`

This avoids overcomplicating the first milestone with a custom monorepo or a separate backend service.

## Current Core Files

- `package.json`
- `vite.config.ts`
- `tsconfig.json`
- `src/main/index.ts`
- `src/preload/index.ts`
- `src/renderer/main.tsx`
- `src/renderer/app/App.tsx`
- `src/renderer/pixi/CanvasBoard.tsx`
- `src/renderer/styles/index.css`
- `src/shared/types/global.d.ts`
- `src/shared/types/project.ts`
- `src/shared/types/ipc.ts`
- `src/shared/constants/shortcuts.ts`
- `src/main/ipc/ipc-handlers.ts`
- `src/main/services/project-service.ts`
- `src/main/services/app-settings-service.ts`
- `src/main/persistence/canvas-project-persistence.ts`
- `src/renderer/state/project-store.tsx`
- `src/renderer/hooks/use-shortcuts.ts`
- `src/renderer/components/TodoList.tsx`

## Scripts

### Dev

```bash
npm run dev
```

Starts:

- React renderer dev server
- Electron main bundle watcher
- preload bundle watcher
- Electron app process

### Build

```bash
npm run build
```

Build outputs:

- `dist/renderer`
- `dist/main`
- `dist/preload`

### Package

```bash
npm run package
```

Targets:

- Windows NSIS installer
- macOS DMG

## What The Agent Should Notice

### 1. React Must Not Own The Canvas

React should manage:

- panels
- dialogs
- task UI
- settings

PixiJS should manage:

- image nodes
- transforms
- selections
- overlays
- rulers
- annotations

Do not build the board out of DOM elements.

### 2. No Direct Node Access In Renderer

Keep:

- `contextIsolation: true`
- `nodeIntegration: false`

All native operations must go through preload and IPC.

### 3. Main Process Is The Local Backend

Put these future services in `src/main`:

- project open/save
- export image/export all
- recent files
- clipboard integration
- desktop capture source listing
- ACO export
- app settings persistence

### 4. Packaging Is Per Platform

Do not treat this like one installer for both OSes.

Ship:

- Windows `.exe`
- macOS `.dmg`

Also note:

- macOS DMG builds should be produced on a Mac
- macOS screen capture requires Screen Recording permission
- signing/notarization will be needed later for real distribution

### 5. Performance Matters Early

The board is not a normal dashboard UI. Agent should design around:

- texture lifecycle
- large image memory usage
- lazy loading
- hit testing on many items
- smooth pan/zoom
- off-main-thread heavy image work where needed

### 6. Undo/Redo Needs Intentional Design

Do not bolt undo on later.

Agent should plan:

- command-based history for item transforms and layout actions
- stroke history for annotation actions
- clear transaction boundaries for multi-select edits

## Implemented MVP Foundation

- zip-based `.canvas` open/save/save-as via `JSZip`
- persisted recent files in Electron user data directory
- title bar file name updates from renderer through preload bridge
- typed project model with groups, items, tasks, and to-do entities
- Pixi board interaction: pan, zoom, selection, multi-select, drag-move, flip
- groups dock with instant group switching preserving per-group viewport state
- task + to-do panel with create, toggle, double-click edit, drag reorder
- shortcut guard: canvas shortcuts ignored while typing in inputs

## MVP v1.3 Feature Checklist (Target)

Status key:

- `[x]` implemented baseline
- `[~]` partial baseline (needs completion/polish)
- `[ ]` not implemented yet

### 1) Canvas & Groups

- `[x]` main canvas with smooth pan/zoom baseline
- `[~]` reference groups with persistent zoom/pan/canvas state (switching done, advanced group UX pending)
- `[ ]` bottom-left slide-out groups panel with triangle scroll bars for large sets

### 2) Reference Image Management

- `[~]` drag/drop + paste import baseline for local files and browser payloads (`text/plain`, `text/uri-list`, `text/html`, `srcset`, `og:image`)
- `[~]` free transform baseline (move implemented, scale/group transform pending)
- `[x]` horizontal flip (`Ctrl+F`) baseline
- `[ ]` double-click zoom overlay + slideshow playback controls
- `[~]` paste import from clipboard baseline + `Ctrl+C` copy-out baseline (first selectable image copied to system clipboard), with clipboard source labeling, import/copy status toasts, import queue history persisted per project in session state, and retry action for blocked previews

### 3) Color Extraction

- `[ ]` auto color extraction from imported images
- `[ ]` right-click export swatches as `.aco`

### 4) Window Capture

- `[ ]` source picker for screen/window capture
- `[ ]` live capture item updates with configurable refresh
- `[ ]` blur + B&W filters for capture items

### 5) Annotation Tools

- `[ ]` doodle mode toggle (`Ctrl+D`)
- `[ ]` brush/eraser with color + size control (`B`, `E`, `[`, `]`)
- `[ ]` color wheel picker
- `[ ]` per-group annotation layer persistence
- `[ ]` undo/redo integration for drawing operations

### 6) Filters & Visual Effects

- `[ ]` global blur toggle/amount (`Ctrl+B`)
- `[ ]` global grayscale toggle (`Ctrl+Y`)

### 7) Ruler Tools

- `[ ]` per-image grid ruler toggle (`Ctrl+R`)
- `[ ]` configurable horizontal/vertical line counts + color

### 8) Auto Arrange & Layout

- `[ ]` Pinterest dynamic layout mode (`F4`)
- `[ ]` horizontal layout mode (`F5`)
- `[ ]` arrange new items without moving locked/manual items
- `[ ]` fit canvas to content (`Ctrl+Shift+F`)

### 9) Storage & App UX

- `[x]` `.canvas` project format baseline (zip manifest/groups/tasks)
- `[x]` open recent files
- `[x]` title bar shows current file name

### 10) Tasks & To-Do (v1.3)

- `[x]` each task has independent to-do list
- `[x]` create/toggle/edit (double-click) items
- `[x]` drag reorder + numbering updates
- `[~]` scroll stability baseline (works in current list; broader stress testing pending)

### 11) Shortcut Coverage

- `[~]` core file/edit/view shortcuts partially wired
- `[ ]` full shortcut matrix wiring exactly as spec (including overlay playback + mode-aware behaviors)

## Recommended Next Modules

Create next:

1. `src/main/capture/` for screen/window source listing + permission UX
2. `src/main/clipboard/` for binary image interoperability
3. `src/main/export/aco.ts` for swatch export
4. `src/renderer/pixi/scene/` with texture-backed image nodes
5. `src/renderer/features/annotations/` with stroke history undo/redo
6. `src/renderer/features/layout/` for Pinterest/horizontal auto-arrange

## First Real Features To Build

Suggested order:

1. project open/save and title updates
2. reference image import from files and clipboard
3. Pixi scene graph for image items
4. selection, move, scale, flip
5. reference groups with persistent viewport
6. annotations and undo/redo

## Validation

Run:

```bash
npm install
npm run build
npm run typecheck
npm run dev
```
