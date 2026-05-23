# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.1] - 2026-05-24

### Added
- Initial public release.
- Clipboard management system for data science workflows.
- Support for VS Code Native Notebook (Jupyter).
- Quick save with keyboard shortcut (Ctrl+Shift+D / Cmd+Shift+D).
- Tag and memo support for clips.
- Pinning functionality for important clips.
- Drag and drop reordering.
- Search and filtering by type, date, filename, and tags.
- Source jump from clips to notebook cells.
- Markdown export functionality.
- Marketplace icon metadata.

### Updated
- README usage instructions for the current command names and Markdown export flow.
- Release packaging now runs a clean build before VSIX creation.
- Marketplace and Activity Bar icons now use smaller publish-ready assets.

### Removed
- Stale build artifacts and local scratch files from the packaged extension.
- Unreferenced documentation images from the packaged extension.
