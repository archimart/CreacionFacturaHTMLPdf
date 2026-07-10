# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Instrucciones de idioma

Responde siempre en español, tanto en el chat como en los comentarios
de código que generes, salvo que se te pida explícitamente lo contrario.

## Commands

```bash
npm run dev        # Start dev server (includes embedded file/workflow API on same port)
npm run build      # Production build
npm run lint       # ESLint
npm run preview    # Preview production build
```

There are no tests. `start-all.bat` also starts a standalone Express API server (`Operativa.engine/packages/core-logic/server.ts` via ts-node) alongside the frontend — but **in dev mode the API is embedded in Vite** (`vite.config.js`), so `npm run dev` alone is sufficient.

## Architecture Overview

This is a **visual document designer** for generating invoices/receipts in bulk from data sources (Excel, CSV, JSON). The UI is entirely in-browser; data and workflow files are saved to the local filesystem via a Vite dev-server middleware.

### Top-level data flow

```
App.jsx
  └─ WorkflowCanvas (ReactFlow node graph)
       ├─ DatabaseNodeEditor    → loads data (XLSX/CSV/JSON) → DataStreamer + GlobalDataRegistry + IndexedDB
       ├─ DocumentDesigner      → visual canvas for one document template
       │    ├─ PaperCanvas      → the A4/Letter paper area
       │    ├─ WorkLayer        → renders all elements, handles drag/resize/rich-text editing
       │    ├─ PropertiesPanel  → inspector for the selected element
       │    ├─ OrderList        → layer tree with drag-to-reorder
       │    └─ ExportTool       → single-record PDF export (html2canvas + jsPDF)
       ├─ PdfGeneratorNodeEditor → bulk PDF generation per record, saved to disk via /api/utils/save-file
       └─ SchedulerNodeEditor / CodeNodeEditor (transform pipeline)
```

### WorkflowCanvas (`src/component/workflow/WorkflowCanvas.jsx`)

The root component rendered by `App.jsx`. Manages the ReactFlow graph, opens node editors in a side panel when a node is clicked. Key exports:

- `GlobalDataRegistry` — a `Map` used to pass large datasets between nodes **outside React state** to avoid diffing overhead. Pattern: `GlobalDataRegistry.set('nodeId-result', records)`.
- `window.__PdfBatchManager` — global singleton for cancellable background PDF batch jobs.

### WorkLayer (`src/component/WorkLayer.jsx`)

The canvas rendering engine. Renders a recursive element tree that supports:

- **Element types**: `text`, `box`, `image`, `sticker`, `table`, `chart`, `barcode`
- **Logical nodes** (invisible wrappers): `logical-if`, `logical-else-if`, `logical-else`, `logical-loop` — control which elements render per record
- **Data interpolation**: `{{fieldName}}` in text elements is replaced with the current data record at render/export time
- **Condition evaluation**: element `el.logic.condition` is evaluated via `new Function` against the current data record using a case-insensitive `Proxy`

Rich text editing uses `contentEditable` + `document.execCommand`. A set of `window` globals coordinates state between `WorkLayer` and `PropertiesPanel` without prop-drilling:

- `window.__LAST_EDITABLE_REF__` / `window.__LAST_EDITABLE_ID__` — currently focused contenteditable node
- `window.__LAST_TABLE_RANGE__` / `window.__LAST_FORMAT_STATE__` — selection and format state for toolbar sync
- `window.__SUPPRESS_EDITABLE_UPDATE__` — callable set by `EditableNode` to suppress a React re-render after an `execCommand` so the browser's format change isn't overwritten
- `window.__EDITOR_DATASET__` — current data record array exposed to `DocumentDesigner` previews

### @engine/core-logic (`Operativa.engine/packages/core-logic/`)

An internal monorepo package (TypeScript, aliased as `@engine/core-logic` via vite.config.js). Key classes:

- **`DataStreamer`** (singleton) — manages large datasets in Web Workers. Components subscribe by `sessionId` and request page ranges; the worker handles transforms (user JS code). Used everywhere data flows through the pipeline.
- **`WorkflowManager`** — reads/writes workflow blueprints as JSON files under `<baseDir>/blueprints/`.
- **`PDFService`** — server-side PDF generation helper.

### Vite embedded API (`vite.config.js` `localApiServer` plugin)

All `/api/*` routes are handled by a Vite middleware (no separate server needed in dev):

- `GET /api/utils/list-dirs?path=...` — filesystem browser
- `POST /api/utils/create-dir` — create directory
- `POST /api/utils/save-file` — write a file (base64 or utf8) to an absolute path (used for PDF output)
- `POST /api/utils/save-files-batch` — batch write
- `GET/POST /api/workflows/*` — workflow CRUD via `WorkflowManager.ts` (imported dynamically at runtime via `import()`)

### Data persistence

| What                        | Where                                                                                           |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| Workflow graphs             | JSON files on disk at a user-chosen `baseDir` under `blueprints/`                               |
| Large node datasets (cache) | IndexedDB `OperativaDataCache` store `datasets` (in `DatabaseNodeEditor`)                       |
| Workflow buffer data        | IndexedDB `WorkflowLargeDataDB` store `nodeBuffers` (`src/utils/dbStorage.js`)                  |
| Active document design      | React state inside `DocumentDesigner` / `WorkflowCanvas`, serialized into workflow JSON on save |

### Paper sizes

`PAPER_PRESETS` in `src/utils/utils.jsx` maps size keys (`letter`, `legal`, `oficio`, `a4`, `a5`, etc.) to dimensions in inches. `ExportTool` multiplies by 72 to get jsPDF points.

## Key patterns

- **Element schema**: every element has `{ id, type, pageId, x, y, w, h, z, style: {}, logic: {condition, loop}, parentId?, ... }`. Style properties follow CSS names but stored flat.
- **No global state library** (no Redux/Zustand). State lives in `WorkflowCanvas` and flows down; cross-cutting editor state uses `window.*` globals.
- **Logical node tree**: `logical-if/else-if/else` nodes own children via `parentId`. `WorkLayer.renderRecursive` walks this tree and evaluates conditions against the active data record.
- The `DataStreamer` is a browser singleton — import and use `DataStreamer.getInstance()`. Session IDs are node-scoped (e.g., `"pdf-nodeId"`).
