# Analysis-Artifacts for VS Code

[![Version](https://img.shields.io/badge/version-0.0.1-blue.svg)](https://github.com/datadeck/analysis-artifacts)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code-Marketplace-blue.svg)](https://marketplace.visualstudio.com/items?itemName=tt00.analysis-artifacts)

Analysis-Artifacts is a VS Code extension for saving, organizing, and exporting important outputs from Jupyter notebooks. It helps data scientists keep useful charts, tables, HTML previews, and notes in a lightweight side panel while they iterate.

## Features

- Save notebook cell outputs to a persistent deck from the cell toolbar or command palette.
- Review saved clips in the Analysis-Artifacts Activity Bar view.
- Search and filter clips by text, output type, tags, notebook file, and date range.
- Pin important clips and reorder clips with drag and drop.
- Add titles, notes, and tags to saved clips.
- Jump from a saved clip back to its source notebook cell.
- Export all clips, or only selected clips, to Markdown.
- Copy referenced image assets next to the generated Markdown file.

## Requirements

- VS Code 1.80.0 or newer.
- A VS Code notebook, such as a Jupyter `.ipynb` file.

## Installation

Install Analysis-Artifacts from the VS Code Marketplace, or install a local VSIX package:

```bash
code --install-extension analysis-artifacts-0.0.1.vsix
```

## Getting Started

1. Open a Jupyter notebook in VS Code.
2. Select a cell that has output you want to keep.
3. Run **Analysis-Artifacts: Add to Deck** from the command palette, click **Add to Deck** in the notebook cell title area, or use the keyboard shortcut:
   - Windows/Linux: `Ctrl+Shift+D`
   - macOS: `Cmd+Shift+D`
4. Open the Analysis-Artifacts view from the Activity Bar to review and manage saved clips.

## Commands

| Command | Description |
| --- | --- |
| `Analysis-Artifacts: Add to Deck` | Saves the selected notebook cell output. |
| `Analysis-Artifacts: Export to Markdown` | Exports saved clips to a Markdown file. |
| `Analysis-Artifacts: Clear All Clips` | Deletes all saved clips and stored image assets for the workspace. |

## Data Storage

Analysis-Artifacts stores workspace data under:

```text
.vscode/analysis-artifacts/
```

This directory can contain saved clip metadata and copied image assets. Add it to your project `.gitignore` if you do not want notebook outputs committed to source control.

## Privacy

Analysis-Artifacts stores clips locally in the current workspace. It does not send notebook outputs, images, or clip metadata to an external service.

## Known Limitations

- Analysis-Artifacts currently targets VS Code native notebooks, including Jupyter `.ipynb` notebooks.
- Clip source navigation depends on notebook file and cell metadata remaining available.
- Large image-heavy decks may increase the size of `.vscode/analysis-artifacts/`.

## Troubleshooting

### A clip is not saved

- Make sure a notebook editor is active.
- Make sure the selected cell has output.
- Make sure you are using VS Code 1.80.0 or newer.

### An image clip is not displayed

- Check whether `.vscode/analysis-artifacts/images/` exists in the workspace.
- Check whether the referenced image file was moved or deleted.

### Exported Markdown does not show images

- Keep the generated asset folder next to the exported Markdown file.
- Avoid moving the Markdown file without also moving its generated assets.

## Release Notes

### 0.0.1

Initial public release.

## License

MIT
