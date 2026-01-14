# Security notes (client-side simulation app)

This app is a **client-side** housing simulation and visualization tool. There is no server-side API in this repo; the primary risks are **XSS**, **prototype pollution**, and **denial-of-service** from extremely large or malformed inputs.

## Threat model

- **Untrusted data** may enter the app via:
  - microdata (`rawByCity`, inferred mappings, weights)
  - historical bundles (`historyBundle`)
  - any future “paste JSON / upload file” features
- **Trusted data** includes source code constants (`HELP`, presets) and bundled markdown (`content/methodology.md`).

## What is sanitized / hardened

- **Markdown rendering**:
  - `src/routes/Methodology.tsx` renders markdown with `ReactMarkdown` using `skipHtml` and URI transformers that block `javascript:` and `data:` URLs.
- **Prototype pollution**:
  - microdata autodetect tenure maps use `Object.create(null)` and block dangerous keys (`__proto__`, `constructor`, `prototype`).
  - microdata by-city result maps are created with null-prototype objects and ignore dangerous keys.
- **History bundles**:
  - `src/security/sanitize.ts` provides `sanitizeHistoryBundle()` which validates core shape and strips dangerous keys before use in sensitive render paths (e.g. the map).

## Remaining assumptions

- React escapes text by default; do not introduce `dangerouslySetInnerHTML` without a rigorous sanitizer.
- If you add user-provided markdown, keep `skipHtml` enabled and continue to sanitize link/image URIs.
- Large datasets can still slow the UI. Keep caps for any future upload/paste flows and consider background workers for heavy parsing.

