# Tracklet MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a working Tracklet MVP scaffold for a macOS menu bar Jira timer with local session tracking and analytics.

**Architecture:** Use a Tauri v2 tray app with Rust commands for auth/sync/timer operations and a lightweight frontend popover UI. Keep Jira integration read-only and persist timer/session data in SQLite with immediate writes on state transitions.

**Tech Stack:** Tauri v2, Rust, SQLite, HTML/CSS/TypeScript UI layer.

---

### Task 1: Create Application Scaffold

**Files:**
- Create: `package.json`
- Create: `README.md`
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/build.rs`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/src/lib.rs`

**Step 1: Write the failing test**

Create a smoke test script that asserts required project files exist.

**Step 2: Run test to verify it fails**

Run: `node --test tests/smoke/project-layout.test.js`
Expected: FAIL because files are missing.

**Step 3: Write minimal implementation**

Add base project files with Tauri command registration skeleton.

**Step 4: Run test to verify it passes**

Run: `node --test tests/smoke/project-layout.test.js`
Expected: PASS with required files detected.

**Step 5: Commit**

```bash
git add package.json README.md src-tauri tests/smoke/project-layout.test.js
git commit -m "chore: scaffold Tracklet tauri project structure"
```

### Task 2: Implement Timer Domain and State Machine

**Files:**
- Create: `src-tauri/src/timer_engine.rs`
- Create: `src-tauri/src/models.rs`
- Modify: `src-tauri/src/lib.rs`
- Create: `tests/domain/timer-state-machine.test.js`
- Create: `src/domain/timer_state_machine.js`

**Step 1: Write the failing test**

Write tests for `Idle -> Running -> Paused -> Running -> Stopped` and one-active-timer enforcement.

**Step 2: Run test to verify it fails**

Run: `node --test tests/domain/timer-state-machine.test.js`
Expected: FAIL because state machine module does not exist.

**Step 3: Write minimal implementation**

Implement transition guards, segment accounting, and public commands in Rust plus mirrored JS domain model for executable tests.

**Step 4: Run test to verify it passes**

Run: `node --test tests/domain/timer-state-machine.test.js`
Expected: PASS with all transition cases green.

**Step 5: Commit**

```bash
git add src-tauri/src/timer_engine.rs src-tauri/src/models.rs src/domain/timer_state_machine.js tests/domain/timer-state-machine.test.js
git commit -m "feat: add timer state machine and lifecycle rules"
```

### Task 3: Add SQLite Schema and Repository Layer

**Files:**
- Create: `src-tauri/migrations/0001_init.sql`
- Create: `src-tauri/src/db.rs`
- Modify: `src-tauri/src/lib.rs`
- Create: `tests/smoke/schema-smoke.test.js`

**Step 1: Write the failing test**

Write schema smoke test asserting required tables and columns exist in migration.

**Step 2: Run test to verify it fails**

Run: `node --test tests/smoke/schema-smoke.test.js`
Expected: FAIL before migration is authored.

**Step 3: Write minimal implementation**

Add schema matching design (`jira_accounts`, `jira_issues`, `time_sessions`, `session_segments`, `app_settings`) and repository scaffolding.

**Step 4: Run test to verify it passes**

Run: `node --test tests/smoke/schema-smoke.test.js`
Expected: PASS with table definitions found.

**Step 5: Commit**

```bash
git add src-tauri/migrations/0001_init.sql src-tauri/src/db.rs tests/smoke/schema-smoke.test.js
git commit -m "feat: add sqlite schema and persistence scaffolding"
```

### Task 4: Add Jira Auth/Issue Sync Command Surface

**Files:**
- Create: `src-tauri/src/jira.rs`
- Create: `src-tauri/src/auth.rs`
- Modify: `src-tauri/src/lib.rs`
- Create: `src/ui/api.js`
- Create: `tests/domain/jira-contract.test.js`

**Step 1: Write the failing test**

Write command contract tests for normalized issue objects and sync status payload shape.

**Step 2: Run test to verify it fails**

Run: `node --test tests/domain/jira-contract.test.js`
Expected: FAIL with missing contract implementation.

**Step 3: Write minimal implementation**

Add backend command stubs for OAuth start/callback handling and issue retrieval contract. Wire frontend API wrapper to invoke these commands.

**Step 4: Run test to verify it passes**

Run: `node --test tests/domain/jira-contract.test.js`
Expected: PASS with expected payload contracts.

**Step 5: Commit**

```bash
git add src-tauri/src/jira.rs src-tauri/src/auth.rs src-tauri/src/lib.rs src/ui/api.js tests/domain/jira-contract.test.js
git commit -m "feat: add jira auth and issue sync command contracts"
```

### Task 5: Build Menu UI and Local Analytics View

**Files:**
- Create: `src/ui/index.html`
- Create: `src/ui/styles.css`
- Create: `src/ui/app.js`
- Create: `src/ui/state.js`
- Create: `tests/ui/analytics-format.test.js`

**Step 1: Write the failing test**

Write analytics formatting test for human-readable durations and issue grouping totals.

**Step 2: Run test to verify it fails**

Run: `node --test tests/ui/analytics-format.test.js`
Expected: FAIL due to missing formatting/state modules.

**Step 3: Write minimal implementation**

Build compact tray UI with issue picker, start/pause/resume/stop controls, active timer label, and analytics list.

**Step 4: Run test to verify it passes**

Run: `node --test tests/ui/analytics-format.test.js`
Expected: PASS with correctly formatted totals.

**Step 5: Commit**

```bash
git add src/ui tests/ui
git commit -m "feat: add tray ui with timer controls and analytics"
```

### Task 6: Verify End-to-End Project Integrity

**Files:**
- Modify: `README.md`

**Step 1: Write the failing test**

Add/update smoke test that checks README includes setup and run instructions.

**Step 2: Run test to verify it fails**

Run: `node --test tests/smoke/project-layout.test.js`
Expected: FAIL if docs are incomplete.

**Step 3: Write minimal implementation**

Document prerequisites, run commands, Jira OAuth configuration notes, and MVP limitations.

**Step 4: Run test to verify it passes**

Run: `node --test tests/smoke/project-layout.test.js tests/domain/*.test.js tests/ui/*.test.js`
Expected: PASS all tests.

**Step 5: Commit**

```bash
git add README.md tests
git commit -m "docs: add setup, verification, and mvp limitation notes"
```
