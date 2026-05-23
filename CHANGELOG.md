# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.3] - 2026-05-09

### Added
- Marketplace icon metadata.
- Manual QA checklist for release validation.

### Updated
- README usage instructions for the current command names and Markdown export flow.
- Release packaging now runs a clean build before VSIX creation.
- Marketplace and Activity Bar icons now use smaller publish-ready assets.

### Removed
- Stale build artifacts and local scratch files from the packaged extension.
- Unreferenced documentation images from the packaged extension.

## [1.0.2] - 2026-05-05

### Added
- Initial stable release
- Clipboard management system for data science workflows
- Support for VS Code Native Notebook (Jupyter)
- Quick save with keyboard shortcut (Ctrl+Shift+D / Cmd+Shift+D)
- Tag and memo support for clips
- Pinning functionality for important clips
- Drag and drop reordering
- Search and filtering (by type, date, filename, tags)
- Source jump (click clip to navigate to source cell)
- Markdown export functionality
- Image lazy loading for performance
- Virtual scrolling for large clip collections
- Gitignore recommendation on first activation

### Features
- **Clip & Store**: Save notebook cell outputs (images, HTML, DataFrame previews) with one click
- **The Deck**: Sidebar dashboard with pinned and recent sections
- **Organization**: Drag & drop sorting, multi-filter support
- **Export**: Generate Markdown reports from saved clips

## [1.0.0] - 2026-04-01

### Added
- Initial beta release
