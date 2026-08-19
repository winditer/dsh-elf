# Changelog

All notable changes to dsh-elf are tracked here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## 2.2.1 — 2026-08-19

- Fixed invisible streaming: a pending assistant message carried the growing
  text in `m.text`, but the render branch drew only the typing dots until the
  reply finished, so the whole answer appeared at once. The bubble now paints
  the accumulating text as tokens arrive (both the host-polled and the custom
  SSE routes), with the typing dots as a fallback before the first token.

## 2.2.0 — 2026-08-19

- UI now follows the DSH settings language and switches between Chinese and
  English live (no reload needed); falls back to the page language on hosts
  without the locale service.
- Host error messages follow the request language; the system prompt is a
  bilingual template so the elf replies in the user's current UI language.

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