mod auth;
mod db;
mod jira;
mod models;
mod timer_engine;

use base64::Engine;
use models::{JiraIssue, TimerSnapshot};
use serde::Serialize;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::image::Image;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconEvent};
use tauri::{Manager, State, WebviewUrl, WebviewWindowBuilder};
use timer_engine::TimerEngine;

const MAIN_WINDOW_LABEL: &str = "main";
const MAIN_WINDOW_WIDTH: f64 = 368.0;
const MAIN_WINDOW_HEIGHT: f64 = 520.0;

struct AppState {
    timer: Mutex<TimerEngine>,
    oauth_state: Mutex<Option<String>>,
    oauth_callback_url: Arc<Mutex<Option<String>>>,
    oauth_callback_error: Arc<Mutex<Option<String>>>,
    jira_session: Mutex<Option<auth::JiraAuthSession>>,
    pending_site_selection: Mutex<Option<auth::PendingSiteSelection>>,
    last_sync_at: Mutex<Option<String>>,
    last_sync_error: Mutex<Option<String>>,
    db: Arc<db::Db>,
}

#[derive(Debug, Serialize)]
struct HealthcheckResponse {
    app: &'static str,
    status: &'static str,
}

#[derive(Debug, Serialize)]
struct OAuthCallbackStatus {
    pending: bool,
    callback_url: Option<String>,
    error: Option<String>,
}

fn parse_loopback_redirect(redirect_uri: &str) -> Result<(String, u16, String), String> {
    let parsed =
        url::Url::parse(redirect_uri).map_err(|error| format!("Invalid redirect URI: {error}"))?;
    if parsed.scheme() != "http" {
        return Err(
            "JIRA_REDIRECT_URI must use http:// for local OAuth callback capture".to_string(),
        );
    }

    let host = parsed
        .host_str()
        .ok_or_else(|| "JIRA_REDIRECT_URI must include a loopback host".to_string())?;
    if host != "127.0.0.1" && host != "localhost" {
        return Err("JIRA_REDIRECT_URI host must be 127.0.0.1 or localhost".to_string());
    }

    let port = parsed
        .port()
        .ok_or_else(|| "JIRA_REDIRECT_URI must include an explicit port".to_string())?;

    let path = if parsed.path().is_empty() {
        "/".to_string()
    } else {
        parsed.path().to_string()
    };

    Ok((host.to_string(), port, path))
}

fn callback_success_html() -> &'static str {
    r#"<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tracklet Authorization Complete</title>
  <style>
    :root {
      --bg-top: #deebff;
      --bg-bottom: #f4f5f7;
      --card-bg: #ffffff;
      --card-border: #dfe1e6;
      --text-main: #172b4d;
      --text-subtle: #44546f;
      --accent: #0c66e4;
      --accent-soft: #e9f2ff;
      --shadow: 0 2px 0 #dfe1e6;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      font-family: "Avenir Next", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif;
      background: linear-gradient(165deg, var(--bg-top) 0%, var(--bg-bottom) 100%);
      color: var(--text-main);
      padding: 24px;
    }

    .card {
      width: min(560px, 100%);
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 20px;
      box-shadow: var(--shadow);
      padding: 28px 24px;
    }

    .badge {
      display: inline-block;
      background: var(--accent-soft);
      color: var(--accent);
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      padding: 7px 11px;
      margin-bottom: 14px;
    }

    h1 {
      margin: 0 0 10px;
      font-size: clamp(24px, 5vw, 34px);
      line-height: 1.15;
    }

    p {
      margin: 0;
      color: var(--text-subtle);
      font-size: 16px;
      line-height: 1.55;
    }

    .footnote {
      margin-top: 16px;
      font-size: 14px;
      color: #4f6588;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <main class="card" role="main" aria-live="polite">
    <span class="badge">Tracklet</span>
    <h1>Authorization complete</h1>
    <p>Tracklet has received your Jira approval. You can return to the app and continue tracking time.</p>
    <p class="footnote">You can close this tab manually.</p>
  </main>
</body>
</html>
"#
}

fn callback_waiting_html(message: &str) -> String {
    format!(
        "<!doctype html><html><body style=\"font-family:-apple-system,Segoe UI,sans-serif;padding:20px;\">\
         <h3>Tracklet callback listener</h3><p>{}</p><p>You can close this tab.</p></body></html>",
        message
    )
}

fn decode_png_data_url(png_data_url: &str) -> Result<Vec<u8>, String> {
    let encoded = png_data_url
        .strip_prefix("data:image/png;base64,")
        .ok_or_else(|| "Expected data:image/png;base64 payload for tray badge".to_string())?;

    base64::engine::general_purpose::STANDARD
        .decode(encoded)
        .map_err(|error| format!("Failed to decode tray badge image: {error}"))
}

fn normalize_path(path: &str) -> String {
    let trimmed = path.trim();
    if trimmed == "/" {
        return "/".to_string();
    }

    trimmed.trim_end_matches('/').to_string()
}

fn spawn_oauth_callback_listener(
    redirect_uri: &str,
    callback_store: Arc<Mutex<Option<String>>>,
    error_store: Arc<Mutex<Option<String>>>,
) -> Result<(), String> {
    const LISTENER_TIMEOUT_SECS: u64 = 180;

    let (host, port, expected_path) = parse_loopback_redirect(redirect_uri)?;
    let listener = std::net::TcpListener::bind(format!("{host}:{port}")).map_err(|error| {
        format!("Failed to bind OAuth callback listener on {host}:{port}: {error}")
    })?;
    listener
        .set_nonblocking(true)
        .map_err(|error| format!("Failed to configure OAuth callback listener: {error}"))?;

    std::thread::spawn(move || {
        let mut callback_error: Option<String> = None;
        let mut last_request_error: Option<String> = None;
        let started = Instant::now();

        loop {
            match listener.accept() {
                Ok((mut stream, _)) => {
                    let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
                    let mut request_buf = [0_u8; 8192];
                    let read_len = match stream.read(&mut request_buf) {
                        Ok(len) => len,
                        Err(_) => {
                            last_request_error =
                                Some("Failed to read callback request bytes".to_string());
                            continue;
                        }
                    };

                    if read_len == 0 {
                        last_request_error = Some("Received empty callback request".to_string());
                        continue;
                    }

                    let request_raw = String::from_utf8_lossy(&request_buf[..read_len]);
                    let request_line = request_raw
                        .lines()
                        .next()
                        .unwrap_or_default()
                        .trim_end_matches('\r');
                    let mut request_parts = request_line.split_whitespace();
                    let method = request_parts.next().unwrap_or("");
                    let target = request_parts.next().unwrap_or("");

                    if method != "GET" || target.is_empty() {
                        last_request_error =
                            Some("Received malformed callback request".to_string());
                        let response = format!(
                            "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\n\r\n{}",
                            callback_waiting_html("Waiting for Jira callback request...")
                        );
                        let _ = stream.write_all(response.as_bytes());
                        continue;
                    }

                    let path_only = target.split('?').next().unwrap_or_default();
                    if normalize_path(path_only) != normalize_path(&expected_path) {
                        last_request_error = Some(format!(
                            "Received callback on unexpected path: {path_only} (expected {expected_path})"
                        ));
                        let response = format!(
                            "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\n\r\n{}",
                            callback_waiting_html("Received a non-callback request. Waiting for Jira redirect...")
                        );
                        let _ = stream.write_all(response.as_bytes());
                        continue;
                    }

                    if !target.contains("code=") || !target.contains("state=") {
                        last_request_error = Some(
                            "Callback path hit without OAuth code/state parameters".to_string(),
                        );
                        let response = format!(
                            "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\n\r\n{}",
                            callback_waiting_html("Callback received but OAuth parameters are missing. Waiting for valid redirect...")
                        );
                        let _ = stream.write_all(response.as_bytes());
                        continue;
                    }

                    let callback_url = format!("http://{host}:{port}{target}");
                    if let Ok(mut guard) = callback_store.lock() {
                        *guard = Some(callback_url);
                    }

                    let response = format!(
                        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\n\r\n{}",
                        callback_success_html()
                    );
                    let _ = stream.write_all(response.as_bytes());
                    break;
                }
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                    if started.elapsed() >= Duration::from_secs(LISTENER_TIMEOUT_SECS) {
                        callback_error = Some(match last_request_error {
                            Some(details) => {
                                format!("Timed out waiting for OAuth callback request. Last request issue: {details}")
                            }
                            None => "Timed out waiting for OAuth callback request".to_string(),
                        });
                        break;
                    }
                    std::thread::sleep(Duration::from_millis(200));
                }
                Err(error) => {
                    callback_error = Some(format!("OAuth callback listener failed: {error}"));
                    break;
                }
            }
        }

        if let Some(error) = callback_error {
            if let Ok(mut guard) = error_store.lock() {
                *guard = Some(error);
            }
        }
    });

    Ok(())
}

fn attempt_auto_select_site(
    pending: &auth::PendingSiteSelection,
) -> Result<Option<String>, String> {
    let mut candidates_with_issues = Vec::new();
    let mut reachable_empty_candidates = Vec::new();
    let mut last_error: Option<String> = None;

    for option in &pending.options {
        match jira::fetch_assigned_not_done_issues(&pending.access_token, &option.cloud_id) {
            Ok(issues) => {
                if issues.is_empty() {
                    reachable_empty_candidates.push(option.cloud_id.clone());
                } else {
                    candidates_with_issues.push(option.cloud_id.clone());
                }
            }
            Err(error) => {
                last_error = Some(format!("{} ({})", error, option.site_url));
            }
        }
    }

    if candidates_with_issues.len() == 1 {
        return Ok(Some(candidates_with_issues[0].clone()));
    }

    if candidates_with_issues.len() > 1 {
        return Ok(None);
    }

    if reachable_empty_candidates.len() == 1 {
        return Ok(Some(reachable_empty_candidates[0].clone()));
    }

    if reachable_empty_candidates.len() > 1 {
        return Ok(None);
    }

    if let Some(error) = last_error {
        return Err(error);
    }

    Ok(None)
}

#[tauri::command]
fn healthcheck() -> HealthcheckResponse {
    HealthcheckResponse {
        app: "Tracklet",
        status: "ok",
    }
}

#[tauri::command]
fn begin_jira_authorization(state: State<'_, AppState>) -> Result<String, String> {
    {
        let guard = state.oauth_state.lock().expect("oauth state lock poisoned");
        if guard.is_some() {
            return Err("Authorization is already in progress. Finish the current Jira consent flow and try again.".to_string());
        }
    }

    let pending_state = format!("tracklet-{}", chrono::Utc::now().timestamp_millis());
    let authorize_url = auth::authorization_url(&pending_state)?;
    let redirect_uri = std::env::var("JIRA_REDIRECT_URI")
        .map_err(|_| "Missing JIRA_REDIRECT_URI environment variable".to_string())?;

    {
        let mut callback_guard = state
            .oauth_callback_url
            .lock()
            .expect("oauth callback url lock poisoned");
        *callback_guard = None;
    }
    {
        let mut error_guard = state
            .oauth_callback_error
            .lock()
            .expect("oauth callback error lock poisoned");
        *error_guard = None;
    }
    {
        let mut pending_site_guard = state
            .pending_site_selection
            .lock()
            .expect("pending site selection lock poisoned");
        *pending_site_guard = None;
    }

    spawn_oauth_callback_listener(
        &redirect_uri,
        Arc::clone(&state.oauth_callback_url),
        Arc::clone(&state.oauth_callback_error),
    )?;

    let mut guard = state.oauth_state.lock().expect("oauth state lock poisoned");
    *guard = Some(pending_state);
    Ok(authorize_url)
}

#[tauri::command]
fn complete_jira_authorization(
    state: State<'_, AppState>,
    callback_url: String,
) -> Result<auth::AuthStatus, String> {
    let expected_state = {
        let guard = state.oauth_state.lock().expect("oauth state lock poisoned");
        guard
            .clone()
            .ok_or_else(|| "No OAuth authorization is currently pending".to_string())?
    };

    let auth_result = auth::complete_authorization(&callback_url, &expected_state);

    {
        let mut guard = state.oauth_state.lock().expect("oauth state lock poisoned");
        *guard = None;
    }
    let mut callback_guard = state
        .oauth_callback_url
        .lock()
        .expect("oauth callback url lock poisoned");
    *callback_guard = None;
    let mut callback_error_guard = state
        .oauth_callback_error
        .lock()
        .expect("oauth callback error lock poisoned");
    *callback_error_guard = None;

    match auth_result {
        Ok(auth::AuthorizationOutcome::Authorized(auth_status, session)) => {
            {
                let mut session_guard = state
                    .jira_session
                    .lock()
                    .expect("jira session lock poisoned");
                *session_guard = Some(session.clone());
            }
            let _ = state.db.save_jira_session(&session);
            {
                let mut pending_site_guard = state
                    .pending_site_selection
                    .lock()
                    .expect("pending site selection lock poisoned");
                *pending_site_guard = None;
            }
            {
                let mut sync_error_guard = state
                    .last_sync_error
                    .lock()
                    .expect("sync error lock poisoned");
                *sync_error_guard = None;
            }
            Ok(auth_status)
        }
        Ok(auth::AuthorizationOutcome::NeedsSiteSelection(pending)) => {
            match attempt_auto_select_site(&pending) {
                Ok(Some(cloud_id)) => {
                    let (auth_status, session) =
                        auth::complete_site_selection(&pending, &cloud_id)?;
                    {
                        let mut session_guard = state
                            .jira_session
                            .lock()
                            .expect("jira session lock poisoned");
                        *session_guard = Some(session.clone());
                    }
                    let _ = state.db.save_jira_session(&session);
                    {
                        let mut pending_site_guard = state
                            .pending_site_selection
                            .lock()
                            .expect("pending site selection lock poisoned");
                        *pending_site_guard = None;
                    }
                    {
                        let mut sync_error_guard = state
                            .last_sync_error
                            .lock()
                            .expect("sync error lock poisoned");
                        *sync_error_guard = None;
                    }
                    Ok(auth_status)
                }
                Ok(None) => {
                    {
                        let mut pending_site_guard = state
                            .pending_site_selection
                            .lock()
                            .expect("pending site selection lock poisoned");
                        *pending_site_guard = Some(pending);
                    }
                    {
                        let mut sync_error_guard = state
                            .last_sync_error
                            .lock()
                            .expect("sync error lock poisoned");
                        *sync_error_guard =
                            Some("Select Jira site to finish authorization".to_string());
                    }
                    Err("Multiple Jira sites are accessible. Select one in Tracklet to finish authorization.".to_string())
                }
                Err(error) => {
                    {
                        let mut pending_site_guard = state
                            .pending_site_selection
                            .lock()
                            .expect("pending site selection lock poisoned");
                        *pending_site_guard = Some(pending);
                    }
                    {
                        let mut sync_error_guard = state
                            .last_sync_error
                            .lock()
                            .expect("sync error lock poisoned");
                        *sync_error_guard = Some(error.clone());
                    }
                    Err(format!(
                        "Unable to auto-detect Jira site from accessible resources: {error}. Select site in Tracklet."
                    ))
                }
            }
        }
        Err(error) => {
            let mut sync_error_guard = state
                .last_sync_error
                .lock()
                .expect("sync error lock poisoned");
            *sync_error_guard = Some(error.clone());
            Err(error)
        }
    }
}

#[tauri::command]
fn pending_jira_sites(state: State<'_, AppState>) -> Vec<auth::JiraSiteOption> {
    state
        .pending_site_selection
        .lock()
        .expect("pending site selection lock poisoned")
        .as_ref()
        .map(|pending| pending.options.clone())
        .unwrap_or_default()
}

#[tauri::command]
fn select_jira_site(
    state: State<'_, AppState>,
    cloud_id: String,
) -> Result<auth::AuthStatus, String> {
    let pending = state
        .pending_site_selection
        .lock()
        .expect("pending site selection lock poisoned")
        .clone()
        .ok_or_else(|| "No pending Jira site selection is available".to_string())?;

    let (auth_status, session) = auth::complete_site_selection(&pending, &cloud_id)?;

    {
        let mut session_guard = state
            .jira_session
            .lock()
            .expect("jira session lock poisoned");
        *session_guard = Some(session.clone());
    }
    let _ = state.db.save_jira_session(&session);
    {
        let mut pending_site_guard = state
            .pending_site_selection
            .lock()
            .expect("pending site selection lock poisoned");
        *pending_site_guard = None;
    }
    {
        let mut sync_error_guard = state
            .last_sync_error
            .lock()
            .expect("sync error lock poisoned");
        *sync_error_guard = None;
    }

    Ok(auth_status)
}

#[tauri::command]
fn fetch_assigned_issues(state: State<'_, AppState>) -> Vec<jira::IssueSummary> {
    let maybe_session = state
        .jira_session
        .lock()
        .expect("jira session lock poisoned")
        .clone();

    let Some(session) = maybe_session else {
        return Vec::new();
    };

    match jira::fetch_assigned_not_done_issues(&session.access_token, &session.cloud_id) {
        Ok(issues) => {
            let mut sync_at_guard = state.last_sync_at.lock().expect("sync at lock poisoned");
            *sync_at_guard = Some(chrono::Utc::now().to_rfc3339());
            let mut sync_error_guard = state
                .last_sync_error
                .lock()
                .expect("sync error lock poisoned");
            *sync_error_guard = None;

            // Cache issues in the background
            if let Some(account_id) = &session.account_id {
                let _ = state.db.save_jira_issues(&issues, account_id);
            }

            issues
        }
        Err(error) => {
            let mut sync_error_guard = state
                .last_sync_error
                .lock()
                .expect("sync error lock poisoned");
            *sync_error_guard = Some(error);
            Vec::new()
        }
    }
}

#[tauri::command]
fn get_cached_issues(state: State<'_, AppState>) -> Vec<jira::IssueSummary> {
    let maybe_session = state
        .jira_session
        .lock()
        .expect("jira session lock poisoned")
        .clone();

    if let Some(session) = maybe_session {
        if let Some(account_id) = session.account_id {
            return state.db.get_jira_issues(&account_id).unwrap_or_default();
        }
    }
    Vec::new()
}

#[tauri::command]
fn jira_sync_status(state: State<'_, AppState>) -> jira::SyncStatus {
    if state
        .pending_site_selection
        .lock()
        .expect("pending site selection lock poisoned")
        .is_some()
    {
        return jira::SyncStatus {
            authorized: false,
            ok: false,
            error: Some("Select Jira site to finish authorization".to_string()),
            last_synced_at: None,
            account_name: None,
            avatar_url: None,
        };
    }

    let has_session = state
        .jira_session
        .lock()
        .expect("jira session lock poisoned")
        .is_some();
    if !has_session {
        return jira::SyncStatus {
            authorized: false,
            ok: false,
            error: Some("Not authorized with Jira".to_string()),
            last_synced_at: None,
            account_name: None,
            avatar_url: None,
        };
    }

    let error = state
        .last_sync_error
        .lock()
        .expect("sync error lock poisoned")
        .clone();
    let last_synced_at = state
        .last_sync_at
        .lock()
        .expect("sync at lock poisoned")
        .clone();

    let (account_name, avatar_url) = {
        let session = state.jira_session.lock().unwrap();
        (
            session.as_ref().and_then(|s| s.account_name.clone()),
            session.as_ref().and_then(|s| s.avatar_url.clone()),
        )
    };

    jira::SyncStatus {
        authorized: true,
        ok: error.is_none(),
        error,
        last_synced_at,
        account_name,
        avatar_url,
    }
}

#[tauri::command]
fn wait_for_oauth_callback(
    state: State<'_, AppState>,
    timeout_ms: Option<u64>,
) -> Result<String, String> {
    if state
        .oauth_state
        .lock()
        .expect("oauth state lock poisoned")
        .is_none()
    {
        return Err("No OAuth authorization is currently pending".to_string());
    }

    let timeout = Duration::from_millis(timeout_ms.unwrap_or(180_000).clamp(1_000, 600_000));
    let started = Instant::now();

    loop {
        {
            let mut error_guard = state
                .oauth_callback_error
                .lock()
                .expect("oauth callback error lock poisoned");
            if let Some(error) = error_guard.take() {
                let mut state_guard = state.oauth_state.lock().expect("oauth state lock poisoned");
                *state_guard = None;
                return Err(error);
            }
        }

        {
            let mut callback_guard = state
                .oauth_callback_url
                .lock()
                .expect("oauth callback url lock poisoned");
            if let Some(callback_url) = callback_guard.take() {
                return Ok(callback_url);
            }
        }

        if started.elapsed() >= timeout {
            let mut state_guard = state.oauth_state.lock().expect("oauth state lock poisoned");
            *state_guard = None;
            return Err("Timed out waiting for Jira OAuth callback".to_string());
        }

        std::thread::sleep(Duration::from_millis(250));
    }
}

#[tauri::command]
fn oauth_callback_status(state: State<'_, AppState>) -> OAuthCallbackStatus {
    let pending = state
        .oauth_state
        .lock()
        .expect("oauth state lock poisoned")
        .is_some();
    let callback_url = state
        .oauth_callback_url
        .lock()
        .expect("oauth callback url lock poisoned")
        .clone();
    let error = state
        .oauth_callback_error
        .lock()
        .expect("oauth callback error lock poisoned")
        .clone();

    OAuthCallbackStatus {
        pending,
        callback_url,
        error,
    }
}

#[tauri::command]
fn timer_snapshot(state: State<'_, AppState>) -> TimerSnapshot {
    let guard = state.timer.lock().expect("timer lock poisoned");
    guard.snapshot()
}

#[tauri::command]
fn start_timer(state: State<'_, AppState>, issue: JiraIssue, at: String) -> TimerSnapshot {
    let mut guard = state.timer.lock().expect("timer lock poisoned");
    guard.start(issue, &at)
}

#[tauri::command]
fn pause_timer(
    state: State<'_, AppState>,
    at: String,
    reason: String,
) -> Result<TimerSnapshot, String> {
    let mut guard = state.timer.lock().expect("timer lock poisoned");
    guard.pause(&at, &reason).map_err(|error| error.to_string())
}

#[tauri::command]
fn resume_timer(state: State<'_, AppState>, at: String) -> Result<TimerSnapshot, String> {
    let mut guard = state.timer.lock().expect("timer lock poisoned");
    guard.resume(&at).map_err(|error| error.to_string())
}

#[tauri::command]
fn stop_timer(state: State<'_, AppState>, at: String, reason: String) -> TimerSnapshot {
    let mut guard = state.timer.lock().expect("timer lock poisoned");
    guard.stop(&at, &reason)
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    let parsed = url::Url::parse(&url).map_err(|error| format!("Invalid URL: {error}"))?;
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err("Only http and https URLs are allowed".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(parsed.as_str())
            .spawn()
            .map_err(|error| format!("Failed to open browser: {error}"))?;
    }

    Ok(())
}

#[tauri::command]
fn set_tray_timer_badge(
    app: tauri::AppHandle,
    png_data_url: String,
    timer_label: Option<String>,
) -> Result<(), String> {
    let tray = app
        .tray_by_id("main")
        .ok_or_else(|| "Tray icon with id `main` was not found".to_string())?;

    let png_bytes = decode_png_data_url(&png_data_url)?;
    let icon = Image::from_bytes(&png_bytes)
        .map_err(|error| format!("Failed to parse tray badge image: {error}"))?;

    tray.set_icon_as_template(false)
        .map_err(|error| format!("Failed to disable template tray icon mode: {error}"))?;
    tray.set_icon(Some(icon))
        .map_err(|error| format!("Failed to update tray badge icon: {error}"))?;

    if let Some(label) = timer_label {
        tray.set_tooltip(Some(format!("Tracklet {label}")))
            .map_err(|error| format!("Failed to update tray tooltip: {error}"))?;
    }

    Ok(())
}

fn ensure_main_window(app: &tauri::AppHandle) {
    if app.get_webview_window(MAIN_WINDOW_LABEL).is_none() {
        let _ =
            WebviewWindowBuilder::new(app, MAIN_WINDOW_LABEL, WebviewUrl::App("index.html".into()))
                .title("Tracklet")
                .inner_size(MAIN_WINDOW_WIDTH, MAIN_WINDOW_HEIGHT)
                .resizable(true)
                .decorations(true)
                .visible(true)
                .build();
    }
}

fn show_main_window(app: &tauri::AppHandle) {
    ensure_main_window(app);
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn load_env_file() {
    let mut contents = None;
    for candidate in [".env", "../.env"] {
        if let Ok(raw) = std::fs::read_to_string(candidate) {
            contents = Some(raw);
            break;
        }
    }

    let Some(contents) = contents else {
        return;
    };

    for line in contents.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        let Some((key, value)) = trimmed.split_once('=') else {
            continue;
        };

        let key = key.trim();
        if key.is_empty() || std::env::var_os(key).is_some() {
            continue;
        }

        let mut value = value.trim().to_string();
        if (value.starts_with('"') && value.ends_with('"'))
            || (value.starts_with('\'') && value.ends_with('\''))
        {
            value = value[1..value.len().saturating_sub(1)].to_string();
        }

        // SAFETY: We only set process env during startup before worker threads are spawned.
        unsafe {
            std::env::set_var(key, value);
        }
    }
}

pub fn run() {
    load_env_file();

    let app_data_dir = std::env::current_dir().unwrap_or_default(); // Fallback for simple dev
    let db_path = app_data_dir.join("tracklet.db");
    
    let database = db::Db::open(&db_path).expect("failed to open database");
    database.migrate().expect("failed to run migrations");
    
    let initial_session = database.get_selected_jira_session().unwrap_or(None);
    let db_arc = Arc::new(database);

    tauri::Builder::default()
        .enable_macos_default_menu(false)
        .manage(AppState {
            timer: Mutex::new(TimerEngine::default()),
            oauth_state: Mutex::new(None),
            oauth_callback_url: Arc::new(Mutex::new(None)),
            oauth_callback_error: Arc::new(Mutex::new(None)),
            jira_session: Mutex::new(initial_session),
            pending_site_selection: Mutex::new(None),
            last_sync_at: Mutex::new(None),
            last_sync_error: Mutex::new(None),
            db: db_arc,
        })
        .setup(|app| {
            // Re-open DB with proper app data path if possible
            if let Ok(path) = app.path().app_data_dir() {
                if !path.exists() {
                    let _ = std::fs::create_dir_all(&path);
                }
                // In a real app we'd migrate here or use a persistent path.
                // For now, tracklet.db in CWD is fine for dev.
            }
            ensure_main_window(&app.handle());
            
            // Proactively refresh avatar if missing
            let handle = app.handle().clone();
            let session_opt = handle.state::<AppState>().jira_session.lock().unwrap().clone();
            if let Some(session) = session_opt {
                if session.avatar_url.is_none() || session.account_name.is_none() {
                    std::thread::spawn(move || {
                        let (_account_id, account_name, avatar_url) = crate::auth::fetch_user_details(&session.access_token);
                        let (_account_id, account_name, avatar_url) = if account_name.is_none() {
                            crate::auth::fetch_user_details_from_site(&session.access_token, &session.cloud_id)
                        } else {
                            (_account_id, account_name, avatar_url)
                        };

                        if avatar_url.is_some() || account_name.is_some() {
                            let mut session = session.clone();
                            if avatar_url.is_some() { session.avatar_url = avatar_url; }
                            if account_name.is_some() { session.account_name = account_name; }
                            
                            let state = handle.state::<AppState>();
                            // Update DB
                            let _ = state.db.save_jira_session(&session);
                            
                            // Update State
                            let mut state_session = state.jira_session.lock().unwrap();
                            *state_session = Some(session);
                        }
                    });
                }
            }
            if let Some(tray) = app.tray_by_id("main") {
                if let (Ok(open), Ok(quit)) = (
                    MenuItem::with_id(app, "open", "Open Tracklet Window", true, None::<&str>),
                    MenuItem::with_id(app, "quit", "Quit Tracklet", true, None::<&str>),
                ) {
                    if let Ok(menu) = Menu::with_items(app, &[&open, &quit]) {
                        let _ = tray.set_menu(Some(menu));
                    }
                }
            }
            Ok(())
        })
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => show_main_window(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(&tray.app_handle());
            }
        })
        .invoke_handler(tauri::generate_handler![
            healthcheck,
            begin_jira_authorization,
            complete_jira_authorization,
            pending_jira_sites,
            select_jira_site,
            wait_for_oauth_callback,
            oauth_callback_status,
            fetch_assigned_issues,
            get_cached_issues,
            jira_sync_status,
            timer_snapshot,
            start_timer,
            pause_timer,
            resume_timer,
            stop_timer,
            open_external_url,
            set_tray_timer_badge
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Tracklet app");
}

#[cfg(test)]
mod tests {
    use super::parse_loopback_redirect;

    #[test]
    fn parse_loopback_redirect_accepts_localhost_http() {
        let parsed = parse_loopback_redirect("http://127.0.0.1:43823/callback")
            .expect("should parse localhost callback");
        assert_eq!(parsed.0, "127.0.0.1");
        assert_eq!(parsed.1, 43823);
        assert_eq!(parsed.2, "/callback");
    }

    #[test]
    fn parse_loopback_redirect_rejects_custom_scheme() {
        let parsed = parse_loopback_redirect("tracklet://oauth/callback");
        assert!(parsed.is_err());
    }

    #[test]
    fn parse_loopback_redirect_requires_explicit_port() {
        let parsed = parse_loopback_redirect("http://127.0.0.1/callback");
        assert!(parsed.is_err());
    }

}
