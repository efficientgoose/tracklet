# Tracklet MVP Design

Date: 2026-02-17
Product: Tracklet
Platform: macOS (menu bar app)
Stack: Tauri v2 + Rust + React/TypeScript + embedded SQLite

## 1. Product Goal
Tracklet is a low-friction personal Jira time tracker that lives in the macOS status bar. Users can authorize Jira with one click, select an issue, start/pause/resume/stop a timer, and view local analytics for time spent per ticket.

Core value:
- Start timer quickly
- Work without context switching
- Stop timer and see where hours went
- No Jira worklog writing in MVP

## 2. Confirmed Requirements
- App name: `Tracklet`
- New standalone project/repo
- Jira auth: OAuth 2.0 (3LO), browser-based single-click authorization
- Issue scope default: assigned-to-me and `statusCategory != Done`
- One active timer at a time
- Timer controls: Start, Pause, Resume, Stop
- Data storage: embedded local SQLite (no separate user install)
- Sleep/lock behavior: auto-pause on sleep/lock; prompt on wake to Resume or Stop
- Jira writes: out of scope for MVP (read-only Jira integration)
- UI direction: comply with latest Apple developer practices and Liquid Glass design direction with accessibility fallbacks

## 3. Architecture
### 3.1 Application Shell
- Tauri v2 tray app focused on menu bar usage
- No persistent main window required for MVP
- Tray popover webview provides primary UI

### 3.2 Responsibilities
Rust backend:
- OAuth start/callback/token lifecycle
- Secure token persistence
- Jira API reads
- Timer engine and lifecycle handling
- Sleep/lock auto-pause and wake prompt signaling
- SQLite persistence and migrations

Frontend (React + TypeScript):
- Issue picker UI
- Timer control UI
- Analytics display
- Lightweight settings and sync status feedback

### 3.3 Status Bar Behavior
- Running example: `2h 34m - JIRA-123`
- Idle example: `No Active Timer`
- Title updates from persisted timer state

## 4. Components
- `StatusBarController`
- `AuthController`
- `JiraSyncService`
- `TimerEngine`
- `AnalyticsService`
- `WakeResumePrompt`

## 5. Data Model (SQLite)
- `jira_accounts` (cloudId, siteUrl, accountId, selected flag)
- `jira_issues` (issueId, key, summary, statusCategory, assignee, updatedAt)
- `time_sessions` (id, issueId, startedAt, endedAt, state)
- `session_segments` (id, sessionId, startedAt, endedAt, reason)
- `app_settings` (ui and behavior preferences)

Notes:
- Session segments preserve precise accounting through pause/resume and sleep events.
- Jira metadata is cached locally for offline continuity.

## 6. Key Flows
### 6.1 Authorization
1. User clicks `Authorize`
2. Browser opens Atlassian consent page
3. Redirect returns to Tracklet deep link callback
4. App exchanges code for tokens and stores securely
5. If multiple sites are accessible, app prompts once to select site

### 6.2 Issue Sync
- Launch refresh + periodic refresh + manual refresh
- Default filter: assigned-to-me and not done
- Sync failures are non-blocking for local timer operations

### 6.3 Timer Lifecycle
State machine:
- `Idle -> Running -> Paused -> Running -> Stopped`

Rules:
- Exactly one active timer
- Starting a different issue auto-stops current running timer first
- All transitions persisted immediately

### 6.4 Sleep/Lock Handling
- On sleep/lock: auto-pause with reason `sleep`
- On wake/unlock: prompt user to Resume or Stop

## 7. Error Handling
- Token expiration: refresh then retry once
- Refresh failure: show `Re-authorize Jira` action
- Jira/network failures: keep timer functional locally, show sync warning
- DB failures: fail-safe stop and actionable error surface
- OAuth state mismatch: reject callback and require new auth

## 8. Apple UX and Accessibility Alignment
- Menu bar-first interaction pattern
- Template tray icon behavior for light/dark mode
- Liquid Glass-inspired layered/translucent surfaces where appropriate
- Accessibility fallbacks:
  - reduced transparency
  - reduced motion
  - high contrast
  - keyboard-first navigation
  - VoiceOver labels

## 9. MVP Scope
In scope:
- Jira OAuth auth
- Issue retrieval (assigned + not done)
- Single active timer with pause/resume/stop
- Sleep/wake auto-pause flow
- Local analytics by issue

Out of scope:
- Jira worklog write-back
- Cross-device sync
- Team analytics/report export
- Calendar integration

## 10. Success Criteria
- One-click Jira authorization works end-to-end
- User can track sessions against Jira issues quickly
- Timing remains accurate across pause/resume/sleep/wake
- Analytics reliably show local time by ticket
- No Jira writes occur in MVP

## 11. Risks and Mitigations
- OAuth complexity: start with strict state validation and explicit callback tests
- Sleep/wake edge cases: event-driven integration tests and persisted transition logs
- Menu bar UI performance: keep popover lightweight and minimize render work

## 12. Verification Strategy
- Unit tests: timer state machine, segment math, aggregations
- Integration tests: OAuth callback, token lifecycle, DB migration/recovery
- UI tests: issue selection, timer controls, wake prompt, analytics rendering
- Manual QA: sleep/wake, offline behavior, accessibility modes

## 13. Sources
- https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/
- https://v2.tauri.app/plugin/deep-linking/
- https://v2.tauri.app/learn/system-tray/
- https://v2.tauri.app/reference/config/#trayiconconfig
- https://developer.apple.com/documentation/technologyoverviews/liquid-glass
- https://developer.apple.com/macos/whats-new/
- https://developer.apple.com/design/human-interface-guidelines/accessibility
