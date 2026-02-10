# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-02-10

### Changed

- Updated AI model configurations to match current cliproxyapi availability
- Replaced deprecated `gemini-claude-opus-4-5-thinking` with `claude-opus-4-6-thinking`
- Reorganized model priority order based on actual API availability

### Added

- Added `gpt-oss-120b-medium` model support
- Added `gemini-3-pro-image-preview` model support
- Added `AGENTS.md` documentation for AI coding agents
- Added `CHANGELOG.md` for release tracking

### Removed

- Removed unavailable GPT-5.x models (gpt-5.2-codex, gpt-5.1-codex-max, gpt-5.2, gpt-5.1-codex, gpt-5.1)
- Removed unavailable `gemini-2.5-pro` model
- Removed unavailable open source models (llama-3.3-70b-versatile, qwen3-32b, llama-3.1-8b-instant)

### Fixed

- Fixed "Claude Opus 4.5 is no longer available" error by updating to Claude Opus 4.6
