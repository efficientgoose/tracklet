use serde::{Deserialize, Serialize};
use std::env;
use url::Url;

#[derive(Clone, Debug, Serialize)]
pub struct AuthStatus {
    pub authorized: bool,
    pub account_id: Option<String>,
    pub site_url: Option<String>,
}

#[derive(Clone, Debug)]
pub struct JiraAuthSession {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub cloud_id: String,
    pub site_url: String,
    pub account_id: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct JiraSiteOption {
    pub cloud_id: String,
    pub site_url: String,
}

#[derive(Clone, Debug)]
pub struct PendingSiteSelection {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub account_id: Option<String>,
    pub options: Vec<JiraSiteOption>,
}

#[derive(Debug)]
pub enum AuthorizationOutcome {
    Authorized(AuthStatus, JiraAuthSession),
    NeedsSiteSelection(PendingSiteSelection),
}

#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
struct AccessibleResource {
    id: String,
    url: String,
    #[serde(default)]
    scopes: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct AtlassianMe {
    account_id: Option<String>,
}

pub fn build_authorization_url(
    client_id: &str,
    redirect_uri: &str,
    state: &str,
    scopes: &str,
) -> Result<String, String> {
    let mut url = Url::parse("https://auth.atlassian.com/authorize")
        .map_err(|error| format!("Failed to construct Jira authorize URL: {error}"))?;

    url.query_pairs_mut()
        .append_pair("audience", "api.atlassian.com")
        .append_pair("client_id", client_id)
        .append_pair("scope", scopes)
        .append_pair("redirect_uri", redirect_uri)
        .append_pair("state", state)
        .append_pair("response_type", "code")
        .append_pair("prompt", "consent");

    Ok(url.to_string())
}

pub fn authorization_url(state: &str) -> Result<String, String> {
    let client_id = env::var("JIRA_CLIENT_ID")
        .map_err(|_| "Missing JIRA_CLIENT_ID environment variable".to_string())?;
    let redirect_uri = env::var("JIRA_REDIRECT_URI")
        .map_err(|_| "Missing JIRA_REDIRECT_URI environment variable".to_string())?;
    let scopes = env::var("JIRA_SCOPES")
        .unwrap_or_else(|_| "read:jira-work read:jira-user offline_access".to_string());

    build_authorization_url(&client_id, &redirect_uri, state, &scopes)
}

fn extract_code_with_expected_state(
    callback_url: &str,
    expected_state: &str,
) -> Result<String, String> {
    let parsed =
        Url::parse(callback_url).map_err(|error| format!("Invalid callback URL: {error}"))?;
    let params = parsed
        .query_pairs()
        .collect::<std::collections::HashMap<_, _>>();

    let code = params
        .get("code")
        .ok_or_else(|| "Missing OAuth code in callback URL".to_string())?;
    if code.is_empty() {
        return Err("OAuth code is empty".to_string());
    }

    let state = params
        .get("state")
        .ok_or_else(|| "Missing OAuth state in callback URL".to_string())?;
    if state != expected_state {
        return Err("OAuth state mismatch".to_string());
    }

    Ok(code.to_string())
}

fn summarize_error_body(body: &str) -> String {
    let compact = body.replace('\n', " ");
    if compact.len() <= 200 {
        compact
    } else {
        format!("{}...", &compact[..200])
    }
}

fn format_send_error(context: &str, error: reqwest::Error) -> String {
    let mut details = format!("{context}: {error}");
    let mut source = std::error::Error::source(&error);
    while let Some(cause) = source {
        details.push_str(&format!(" | caused by: {cause}"));
        source = cause.source();
    }
    details
}

fn oauth_env() -> Result<(String, String, String), String> {
    let client_id = env::var("JIRA_CLIENT_ID")
        .map_err(|_| "Missing JIRA_CLIENT_ID environment variable".to_string())?;
    let client_secret = env::var("JIRA_CLIENT_SECRET")
        .map_err(|_| "Missing JIRA_CLIENT_SECRET environment variable".to_string())?;
    let redirect_uri = env::var("JIRA_REDIRECT_URI")
        .map_err(|_| "Missing JIRA_REDIRECT_URI environment variable".to_string())?;
    Ok((client_id, client_secret, redirect_uri))
}

fn exchange_code_for_token(code: &str) -> Result<TokenResponse, String> {
    let (client_id, client_secret, redirect_uri) = oauth_env()?;
    let client = reqwest::blocking::Client::builder()
        .user_agent("Tracklet/0.1.0")
        .build()
        .map_err(|error| format!("Failed to create OAuth HTTP client: {error}"))?;

    let response = client
        .post("https://auth.atlassian.com/oauth/token")
        .json(&serde_json::json!({
            "grant_type": "authorization_code",
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
            "redirect_uri": redirect_uri
        }))
        .send()
        .map_err(|error| format_send_error("Failed to exchange OAuth code", error))?;

    let status = response.status();
    let body = response
        .text()
        .map_err(|error| format!("Failed to read OAuth token response: {error}"))?;

    if !status.is_success() {
        return Err(format!(
            "OAuth token exchange failed ({}): {}",
            status.as_u16(),
            summarize_error_body(&body)
        ));
    }

    serde_json::from_str(&body)
        .map_err(|error| format!("Failed to parse OAuth token response: {error}"))
}

fn fetch_accessible_resources(access_token: &str) -> Result<Vec<AccessibleResource>, String> {
    let client = reqwest::blocking::Client::builder()
        .user_agent("Tracklet/0.1.0")
        .build()
        .map_err(|error| format!("Failed to create OAuth HTTP client: {error}"))?;

    let response = client
        .get("https://api.atlassian.com/oauth/token/accessible-resources")
        .bearer_auth(access_token)
        .send()
        .map_err(|error| format_send_error("Failed to fetch accessible Jira resources", error))?;

    let status = response.status();
    let body = response
        .text()
        .map_err(|error| format!("Failed to read accessible resources response: {error}"))?;

    if !status.is_success() {
        return Err(format!(
            "Accessible resources request failed ({}): {}",
            status.as_u16(),
            summarize_error_body(&body)
        ));
    }

    serde_json::from_str(&body)
        .map_err(|error| format!("Failed to parse accessible resources response: {error}"))
}

fn selected_site_preferences() -> (Option<String>, Option<String>) {
    (
        env::var("JIRA_CLOUD_ID").ok(),
        env::var("JIRA_SITE_URL").ok(),
    )
}

fn normalize_site_host(value: &str) -> Option<String> {
    if let Ok(url) = Url::parse(value) {
        return url.host_str().map(|host| host.to_ascii_lowercase());
    }

    Some(
        value
            .trim()
            .trim_start_matches("https://")
            .trim_start_matches("http://")
            .trim_end_matches('/')
            .to_ascii_lowercase(),
    )
}

fn select_resource_with_preferences(
    resources: &[AccessibleResource],
    preferred_cloud_id: Option<&str>,
    preferred_site_url: Option<&str>,
) -> Result<AccessibleResource, String> {
    let jira_resources: Vec<AccessibleResource> = resources
        .iter()
        .filter(|resource| {
            resource
                .scopes
                .iter()
                .any(|scope| scope == "read:jira-work")
        })
        .cloned()
        .collect();

    if jira_resources.is_empty() {
        return Err(
            "No accessible Jira resources with read:jira-work scope were returned".to_string(),
        );
    }

    if let Some(cloud_id) = preferred_cloud_id {
        if let Some(resource) = jira_resources
            .iter()
            .find(|resource| resource.id == cloud_id)
        {
            return Ok(resource.clone());
        }
        return Err(format!(
            "Configured JIRA_CLOUD_ID was not found: {cloud_id}"
        ));
    }

    if let Some(site_url) = preferred_site_url {
        let wanted_host = normalize_site_host(site_url)
            .ok_or_else(|| format!("Configured JIRA_SITE_URL is invalid: {site_url}"))?;
        if let Some(resource) = jira_resources.iter().find(|resource| {
            normalize_site_host(&resource.url)
                .map(|host| host == wanted_host)
                .unwrap_or(false)
        }) {
            return Ok(resource.clone());
        }
        return Err(format!(
            "Configured JIRA_SITE_URL was not found: {site_url}"
        ));
    }

    if jira_resources.len() == 1 {
        return Ok(jira_resources[0].clone());
    }

    let options = jira_resources
        .iter()
        .map(|resource| format!("{} ({})", resource.id, resource.url))
        .collect::<Vec<_>>()
        .join(", ");

    Err(format!(
        "Multiple Jira sites are accessible. Set JIRA_CLOUD_ID or JIRA_SITE_URL in .env. Options: {options}"
    ))
}

fn jira_resources_with_scope(resources: &[AccessibleResource]) -> Vec<AccessibleResource> {
    resources
        .iter()
        .filter(|resource| {
            resource
                .scopes
                .iter()
                .any(|scope| scope == "read:jira-work")
        })
        .cloned()
        .collect()
}

fn to_site_options(resources: &[AccessibleResource]) -> Vec<JiraSiteOption> {
    resources
        .iter()
        .map(|resource| JiraSiteOption {
            cloud_id: resource.id.clone(),
            site_url: resource.url.clone(),
        })
        .collect()
}

fn build_auth_session(
    access_token: String,
    refresh_token: Option<String>,
    account_id: Option<String>,
    cloud_id: String,
    site_url: String,
) -> (AuthStatus, JiraAuthSession) {
    let session = JiraAuthSession {
        access_token,
        refresh_token,
        cloud_id,
        site_url: site_url.clone(),
        account_id: account_id.clone(),
    };

    let status = AuthStatus {
        authorized: true,
        account_id,
        site_url: Some(site_url),
    };

    (status, session)
}

fn fetch_account_id(access_token: &str) -> Option<String> {
    let client = reqwest::blocking::Client::builder()
        .user_agent("Tracklet/0.1.0")
        .build()
        .ok()?;

    let response = client
        .get("https://api.atlassian.com/me")
        .bearer_auth(access_token)
        .send()
        .ok()?;
    if !response.status().is_success() {
        return None;
    }

    response
        .json::<AtlassianMe>()
        .ok()
        .and_then(|me| me.account_id)
}

pub fn complete_authorization(
    callback_url: &str,
    expected_state: &str,
) -> Result<AuthorizationOutcome, String> {
    let code = extract_code_with_expected_state(callback_url, expected_state)?;
    let token = exchange_code_for_token(&code)?;
    let resources = fetch_accessible_resources(&token.access_token)?;
    let jira_resources = jira_resources_with_scope(&resources);
    if jira_resources.is_empty() {
        return Err(
            "No accessible Jira resources with read:jira-work scope were returned".to_string(),
        );
    }

    let account_id = fetch_account_id(&token.access_token);
    let (preferred_cloud_id, preferred_site_url) = selected_site_preferences();

    if preferred_cloud_id.is_some() || preferred_site_url.is_some() {
        let selected_resource = select_resource_with_preferences(
            &jira_resources,
            preferred_cloud_id.as_deref(),
            preferred_site_url.as_deref(),
        )?;
        let (status, session) = build_auth_session(
            token.access_token,
            token.refresh_token,
            account_id,
            selected_resource.id,
            selected_resource.url,
        );
        return Ok(AuthorizationOutcome::Authorized(status, session));
    }

    if jira_resources.len() == 1 {
        let selected_resource = jira_resources[0].clone();
        let (status, session) = build_auth_session(
            token.access_token,
            token.refresh_token,
            account_id,
            selected_resource.id,
            selected_resource.url,
        );
        return Ok(AuthorizationOutcome::Authorized(status, session));
    }

    Ok(AuthorizationOutcome::NeedsSiteSelection(
        PendingSiteSelection {
            access_token: token.access_token,
            refresh_token: token.refresh_token,
            account_id,
            options: to_site_options(&jira_resources),
        },
    ))
}

pub fn complete_site_selection(
    pending: &PendingSiteSelection,
    cloud_id: &str,
) -> Result<(AuthStatus, JiraAuthSession), String> {
    let site = pending
        .options
        .iter()
        .find(|option| option.cloud_id == cloud_id)
        .ok_or_else(|| format!("Invalid Jira site selection: {cloud_id}"))?;

    Ok(build_auth_session(
        pending.access_token.clone(),
        pending.refresh_token.clone(),
        pending.account_id.clone(),
        site.cloud_id.clone(),
        site.site_url.clone(),
    ))
}

pub fn complete_callback_with_expected_state(
    callback_url: &str,
    expected_state: &str,
) -> Result<AuthStatus, String> {
    extract_code_with_expected_state(callback_url, expected_state)?;

    Ok(AuthStatus {
        authorized: true,
        account_id: None,
        site_url: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_authorize_url_with_required_oauth_fields() {
        let url = build_authorization_url(
            "client-123",
            "tracklet://oauth/callback",
            "state-abc",
            "read:jira-work offline_access",
        )
        .expect("should build URL");

        assert!(url.contains("https://auth.atlassian.com/authorize"));
        assert!(url.contains("client_id=client-123"));
        assert!(url.contains("redirect_uri=tracklet%3A%2F%2Foauth%2Fcallback"));
        assert!(url.contains("response_type=code"));
        assert!(url.contains("state=state-abc"));
    }

    #[test]
    fn rejects_callback_when_state_mismatches() {
        let result = complete_callback_with_expected_state(
            "tracklet://oauth/callback?code=abc&state=bad-state",
            "good-state",
        );

        assert!(result.is_err());
    }

    #[test]
    fn extracts_code_when_state_matches() {
        let code = extract_code_with_expected_state(
            "http://127.0.0.1:43823/callback?code=abc123&state=good-state",
            "good-state",
        )
        .expect("should extract code");

        assert_eq!(code, "abc123");
    }

    #[test]
    fn selects_resource_with_jira_scope_when_available() {
        let resources = vec![
            AccessibleResource {
                id: "site-1".to_string(),
                url: "https://site-1.atlassian.net".to_string(),
                scopes: vec!["read:confluence-content".to_string()],
            },
            AccessibleResource {
                id: "site-2".to_string(),
                url: "https://site-2.atlassian.net".to_string(),
                scopes: vec!["read:jira-work".to_string()],
            },
        ];

        let selected = select_resource_with_preferences(&resources, Some("site-2"), None)
            .expect("should select resource");
        assert_eq!(selected.id, "site-2");
    }

    #[test]
    fn errors_when_multiple_sites_without_preference() {
        let resources = vec![
            AccessibleResource {
                id: "site-1".to_string(),
                url: "https://site-1.atlassian.net".to_string(),
                scopes: vec!["read:jira-work".to_string()],
            },
            AccessibleResource {
                id: "site-2".to_string(),
                url: "https://site-2.atlassian.net".to_string(),
                scopes: vec!["read:jira-work".to_string()],
            },
        ];

        let error = select_resource_with_preferences(&resources, None, None)
            .expect_err("should require preference");
        assert!(error.contains("Multiple Jira sites are accessible"));
    }

    #[test]
    fn selects_site_using_site_url_preference() {
        let resources = vec![
            AccessibleResource {
                id: "site-1".to_string(),
                url: "https://site-1.atlassian.net".to_string(),
                scopes: vec!["read:jira-work".to_string()],
            },
            AccessibleResource {
                id: "site-2".to_string(),
                url: "https://site-2.atlassian.net".to_string(),
                scopes: vec!["read:jira-work".to_string()],
            },
        ];

        let selected = select_resource_with_preferences(
            &resources,
            None,
            Some("https://site-1.atlassian.net"),
        )
        .expect("should select by site url");
        assert_eq!(selected.id, "site-1");
    }
}
