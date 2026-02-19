# Changelog

All notable changes to **ProTrack AI** will be documented in this file.

## [Unreleased]
- **Regression Prevention:** Added Vitest + React Testing Library infrastructure.
- **Process:** Added `BASELINE.md` to lock critical requirements.
- **Process:** Added `featureFlagService` for safe feature rollouts.

## [V3.6.2] - Current Baseline
### Added
- **Weekly Timeline Card Update:** 
    - Increased Title Font Size (Bold/Small).
    - Added Priority Dot (Color mapped to priority settings).
    - Added "Done" state styling (Greyed out/Strikethrough).
- **Fix:** `TaskDetailModal` now uses live task object reference to prevent stale data.
- **Fix:** Added missing `X` icon import in `App.tsx`.

### Changed
- Refactored `App.tsx` render logic for improved stability.

### Removed
- *None approved.*
