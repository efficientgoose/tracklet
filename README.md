# TrackIt

TrackIt is a Tauri desktop app for Jira-linked personal time tracking. The current codebase uses a React + TypeScript UI, a Rust/Tauri backend, SQLite for local persistence, and a macOS tray-first windowed experience.

The visible product name is being updated to `TrackIt`. Some internal package names and identifiers in the repo still use `tracklet` for compatibility with the current code.

## Current Feature Set

- Jira OAuth authorization against Atlassian Cloud
- Local loopback callback capture via `http://127.0.0.1:43823/callback`
- Assigned-issue sync from Jira after authorization
- Jira site selection when the authenticated account can access multiple sites
- Local fallback timer start even when no Jira issue is selected
- Focus/break countdown flow with auto-start options
- Tray timer badge updates while a countdown is active
- Local analytics and daily breakdown views backed by SQLite
- Cached Jira/account state persisted locally between launches

## Tech Stack

- Tauri 2
- Rust
- React 19
- TypeScript
- SQLite via `rusqlite`
- `esbuild` for the UI bundle

## Prerequisites

- Node.js 20+
- Rust toolchain (`rustup`, `cargo`)
- Tauri CLI

Install dependencies:

```bash
npm install
cargo install tauri-cli
```

## Environment Configuration

Create a `.env` file in the repository root before running the app:

```bash
JIRA_CLIENT_ID=your_atlassian_oauth_client_id
JIRA_CLIENT_SECRET=your_atlassian_oauth_client_secret
JIRA_REDIRECT_URI=http://127.0.0.1:43823/callback

# Optional: narrow multi-site authorization to a single Jira site
# JIRA_CLOUD_ID=your_preferred_jira_cloud_id
# JIRA_SITE_URL=https://your-site.atlassian.net
```

Important notes:

- `JIRA_REDIRECT_URI` must be an `http://` loopback URL using `127.0.0.1` or `localhost`.
- The redirect URI must include an explicit port.
- The same redirect URI must be configured in the Atlassian OAuth app.
- The code currently requests the scopes `read:jira-work read:jira-user offline_access`.

## Development Commands

Run the test suite:

```bash
npm test
```

Run smoke tests only:

```bash
npm run test:smoke
```

Run type checking:

```bash
npm run typecheck
```

Build the frontend bundle:

```bash
npm run build:ui
```

Start the desktop app in development:

```bash
npm run tauri:dev
```

Build a desktop bundle:

```bash
npm run tauri:build
```

## Project Layout

- `src/ui/`: React UI, timer flow, analytics view, and Jira authorization UI
- `src/domain/`: shared TypeScript domain helpers
- `src-tauri/src/`: Rust commands, OAuth flow, Jira integration, timer engine, and DB access
- `src-tauri/migrations/`: SQLite schema migrations
- `tests/`: UI, domain, and smoke tests

## Current Behavior Notes

- The app listens locally for the Jira OAuth callback instead of using a custom URI scheme.
- If multiple Jira sites are available, the app may require `JIRA_CLOUD_ID` or `JIRA_SITE_URL` to disambiguate.
- Timer and analytics behavior are covered by lightweight Node test files that inspect app structure and domain logic.
- Local persisted data currently uses existing internal `tracklet` storage names in the codebase.

## Known Gaps

- Jira sync is read-only; there is no Jira worklog write-back.
- The app is currently macOS-oriented (`macOSPrivateApi` is enabled in Tauri config).
- Some generated and historical design files still reference `Tracklet`.
