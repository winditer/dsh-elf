# Changelog

All notable changes to dsh-elf are tracked here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## 2.1.0 — 2026-08-18

- Added the two README screenshots used by plugin storefronts.
- Fixed the source-install clone URL in both READMEs.
- Synced the `minimumReleaseAgeExclude` example with the current version.

## 2.0.0 — 2026-08-18

- Initial release: a translucent DeepSeek whale elf floating on the DSH page.
- Click to open a draggable / minimizable temporary chat window that never
  touches session history; follows the session default model with zero config,
  or any OpenAI-compatible endpoint (native SSE streaming) in custom mode.
- Drag position, config, window state and chat history persist in
  `localStorage` (keys under `dsh-elf:`).