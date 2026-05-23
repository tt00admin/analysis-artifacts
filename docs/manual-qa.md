# DataDeck Manual QA Checklist

Run this checklist before packaging or publishing.

## Environment

- VS Code 1.80 or later
- Jupyter extension enabled
- A workspace containing at least one `.ipynb`

## Core Capture

- Select a notebook cell with no output and verify the Add button is disabled or explains why it cannot run.
- Run a cell that produces `text/plain`; add it to DataDeck and verify a text card appears.
- Run a cell that produces an image; add it to DataDeck and verify the image renders and shows dimensions/file size when available.
- Run a cell that produces HTML/table output; add it to DataDeck and verify scripts do not execute.
- Toggle "pin on save" and verify the new clip appears in Pinned.

## Card Operations

- Edit title, memo, and tags; reload the sidebar and verify persistence.
- Filter by text, type, tag, date, and notebook filename.
- Reset filters and verify the full deck is shown.
- Use the source jump button after reopening the notebook; verify it finds the cell or shows a clear warning.
- Delete a clip and verify confirmation appears.

## Ordering

- Drag pinned clips and reload; verify order is preserved.
- Drag recent clips within the same type carousel and reload; verify the same clips moved.

## Export

- Select two clips and export Markdown; verify only selected clips are included.
- Export without a selection; verify all clips are included.
- For image clips, verify the exported Markdown references `<report-name>-assets/` and the copied image exists.

## Storage Recovery

- Back up `.vscode/datadeck/clips.json`, replace it with invalid JSON, and reload DataDeck.
- Verify a `clips.corrupt.<timestamp>.json` backup is created and the sidebar recovers with an empty deck.

## Clear All

- Run "Clear All Clips" from the command palette.
- Verify confirmation is required.
- Verify `clips.json` has no clips and unreferenced images are removed.
