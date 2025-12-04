# Legacy Baseline v0

- Snapshot date: $(date -u "+%Y-%m-%dT%H:%M:%SZ") UTC
- Source commit: 89de4d5edabf9f193b50faf1e513b78001e77f74 (pre-tooling ref)
- Contents: static `index.html`, `css/`, `js/` logic, and vendored `src/jquery-3.4.1.js` as they existed prior to the Vite/TypeScript refactor.

This folder acts as the “known good” rat-race build used for smoke tests and regression checks until the modular rewrite reaches feature parity. Do not edit files inside this directory; reproduce changes upstream and capture a fresh snapshot instead.
