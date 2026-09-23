# React Flow migration

This repository now contains a React + React Flow implementation beside the existing single-file HTML editor. The legacy editor remains available as `Telecom_Block_Diagram_Maker_CAD_Editing_V19.html` while the interaction layer is migrated incrementally.

## Run

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## Implemented in the React editor

- React Flow canvas with pan, zoom, fit, MiniMap and grid backgrounds.
- 8 connection handles per telecom node using loose connection mode.
- Existing preset symbol catalog extracted from the legacy V19/V20 editor during dev/build.
- Drag/drop and double-click symbol placement.
- Multi-selection, marquee selection, keyboard deletion, node resize and snap-to-grid.
- Source-based PAGA, PCCTV and IT/Voice starter diagrams.
- Device/edge property editing with engineering metadata and source references.
- Diagram register and CSV export.
- Legacy-compatible JSON export: old-format `nodes`, `links`, `zones`, `notes` remain top-level; React Flow state is stored under `reactFlow`.
- Import of both legacy project JSON and React Flow project JSON.
- Local autosave and undo/redo snapshots.
- Basic validation for duplicate tags, broken connections, orphan devices and missing source references.

## Deliberately retained in the legacy editor during migration

- Existing PDF/SVG/DXF drawing export engine.
- Manual route bend-node editing and the exact V19 CAD route-grip behavior.
- Custom symbol builder/import workflow.

These should be ported after React Flow editing parity is validated so export and CAD behavior are not regressed by the UI migration.
