use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize)]
pub struct IssueSummary {
    pub issue_id: String,
    pub issue_key: String,
    pub summary: String,
    pub status_category: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct SyncStatus {
    pub authorized: bool,
    pub ok: bool,
    pub error: Option<String>,
    pub last_synced_at: Option<String>,
    pub account_name: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct JiraSearchResponse {
    issues: Vec<JiraSearchIssue>,
}

#[derive(Debug, Deserialize)]
struct JiraSearchIssue {
    id: String,
    key: String,
    fields: JiraSearchFields,
}

#[derive(Debug, Deserialize)]
struct JiraSearchFields {
    summary: Option<String>,
    status: Option<JiraStatus>,
}

#[derive(Debug, Deserialize)]
struct JiraStatus {
    #[serde(rename = "statusCategory")]
    status_category: Option<JiraStatusCategory>,
}

#[derive(Debug, Deserialize)]
struct JiraStatusCategory {
    name: Option<String>,
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

fn parse_issue_search_response(body: &str) -> Result<Vec<IssueSummary>, String> {
    let parsed: JiraSearchResponse = serde_json::from_str(body)
        .map_err(|error| format!("Failed to parse Jira response: {error}"))?;

    Ok(parsed
        .issues
        .into_iter()
        .map(|issue| IssueSummary {
            issue_id: issue.id,
            issue_key: issue.key,
            summary: issue.fields.summary.unwrap_or_default(),
            status_category: issue
                .fields
                .status
                .and_then(|status| status.status_category)
                .and_then(|category| category.name)
                .unwrap_or_else(|| "Unknown".to_string()),
        })
        .collect())
}

pub fn fetch_assigned_not_done_issues(
    access_token: &str,
    cloud_id: &str,
) -> Result<Vec<IssueSummary>, String> {
    let endpoint = format!("https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3/search/jql");
    let client = reqwest::blocking::Client::builder()
        .user_agent("Tracklet/0.1.0")
        .build()
        .map_err(|error| format!("Failed to create Jira HTTP client: {error}"))?;

    let response = client
        .get(&endpoint)
        .bearer_auth(access_token)
        .query(&[
            (
                "jql",
                "assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC",
            ),
            ("fields", "summary,status"),
            ("maxResults", "50"),
        ])
        .send()
        .map_err(|error| format_send_error("Failed to fetch Jira issues", error))?;

    let status = response.status();
    let body = response
        .text()
        .map_err(|error| format!("Failed to read Jira response body: {error}"))?;

    if !status.is_success() {
        return Err(format!(
            "Jira issues request failed ({}): {}",
            status.as_u16(),
            summarize_error_body(&body)
        ));
    }

    parse_issue_search_response(&body)
}

#[cfg(test)]
mod tests {
    use super::parse_issue_search_response;

    #[test]
    fn parse_issue_search_response_maps_issue_fields() {
        let payload = r#"{
          "issues": [
            {
              "id": "10001",
              "key": "JIRA-123",
              "fields": {
                "summary": "Build tracker",
                "status": {
                  "statusCategory": {
                    "name": "In Progress"
                  }
                }
              }
            }
          ]
        }"#;

        let issues = parse_issue_search_response(payload).expect("should parse response");
        assert_eq!(issues.len(), 1);
        assert_eq!(issues[0].issue_id, "10001");
        assert_eq!(issues[0].issue_key, "JIRA-123");
        assert_eq!(issues[0].summary, "Build tracker");
        assert_eq!(issues[0].status_category, "In Progress");
    }

    #[test]
    fn parse_issue_search_response_falls_back_to_unknown_status() {
        let payload = r#"{
          "issues": [
            {
              "id": "10002",
              "key": "JIRA-456",
              "fields": {
                "summary": "No status category"
              }
            }
          ]
        }"#;

        let issues = parse_issue_search_response(payload).expect("should parse response");
        assert_eq!(issues[0].status_category, "Unknown");
    }
}
