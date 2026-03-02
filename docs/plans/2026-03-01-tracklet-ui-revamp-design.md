# Tracklet UI Revamp Design

**Date:** March 1, 2026

## Goal
Replace the current Tracklet UI with the figmake `tracklet-mvp` visual design while keeping the existing Tauri + TypeScript frontend/backend integration.

## Constraints
- Keep existing tech stack and build flow (`src/ui/*`, esbuild script, Tauri invoke APIs).
- Preserve current backend API contracts for Jira OAuth, issue fetch, timer lifecycle, tray badge updates, and snapshot analytics.
- Add two OAuth entry points that both open browser auth:
  - Header `Connect Jira`
  - Ticket dropdown `Connect Jira to track tickets`
- Remove Jira settings tab from modal; settings modal is timer-only.

## Architecture
- Replace `src/ui/App.tsx` with a single-page React implementation that mirrors figmake layout and visual hierarchy:
  - Widget header, segmented tabs, timer panel, analytics panel, settings modal.
- Replace `src/ui/styles.css` with figmake-inspired styling tokens and component classes.
- Keep existing data hooks and business logic:
  - `beginAuthorization` flow and callback completion
  - `fetchAssignedIssues` and sync status
  - `startTimer`/`stopTimer`, sleep gap pause/resume, tray badge updates
  - `aggregateAnalytics` output

## Components
- Header: logo, title, Jira connected chip or connect button, settings button.
- Timer panel:
  - Circular timer ring and time text
  - Duration controls
  - Primary start/stop action
  - Ticket dropdown with searchable list
- Analytics panel:
  - Summary cards + session list styled like figmake cards
- Settings modal:
  - Timer settings only (duration + auto-start toggles)
  - No Jira tab or Jira credential fields

## Error Handling
- OAuth and sync failures continue using existing `toErrorMessage` and sync warning message state.
- Issue loading and auth-in-progress states are reflected in button disabled states and dropdown copy.

## Testing Plan
- Add test coverage for:
  - Both connect entry points calling browser OAuth flow handler
  - Settings modal having timer controls and no Jira tab
- Update UI regex tests that relied on previous class names and authorize card structure.
- Run:
  - `node --test tests/ui/*.test.ts`
  - `node --test tests/smoke/*.test.ts`
