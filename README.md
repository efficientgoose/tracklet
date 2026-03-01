# Tracklet

Tracklet is a macOS menu bar app for Jira-linked personal time tracking.
The project uses TypeScript across application code and tests.

## MVP Scope
- Jira OAuth connect flow
- Assigned Jira issue selection
- Start, pause, resume, stop timer lifecycle
- Local analytics by Jira issue

## Development Prerequisites
- Node.js 20+
- Rust toolchain (`rustup`, `cargo`)
- Tauri CLI (`cargo install tauri-cli`)
- Jira OAuth app credentials (client ID + redirect URI) for real Jira API access

Create a `.env` file in project root:
```bash
JIRA_CLIENT_ID=your_atlassian_oauth_client_id
JIRA_CLIENT_SECRET=your_atlassian_oauth_client_secret
JIRA_REDIRECT_URI=http://127.0.0.1:43823/callback
# Optional override
# JIRA_SCOPES=read:jira-work read:jira-user offline_access
# Optional site pinning when you can access multiple Jira sites
# JIRA_CLOUD_ID=your_preferred_jira_cloud_id
# JIRA_SITE_URL=https://your-site.atlassian.net
```

In the Atlassian OAuth app settings, configure the exact same callback URL:
`http://127.0.0.1:43823/callback`

## Verify
```bash
npm test
npm run typecheck
```

## Run (once Rust/Tauri are installed)
```bash
npm run tauri:dev
```

## MVP Limitations
- Jira issue sync is read-only (no worklog write-back in MVP).
- Sleep/wake auto-pause prompts are not yet connected to native macOS lifecycle events.
- Jira worklog write-back is intentionally out of scope for this MVP.
