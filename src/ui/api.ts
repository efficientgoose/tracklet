// @ts-nocheck
function getInvoke() {
  if (globalThis?.window?.__TAURI__?.core?.invoke) {
    return globalThis.window.__TAURI__.core.invoke;
  }

  return null;
}

function nowIso() {
  return new Date().toISOString();
}

export function normalizeIssue(raw) {
  return {
    issueId: String(raw.id ?? raw.issueId ?? ''),
    issueKey: String(raw.key ?? raw.issueKey ?? ''),
    summary: String(raw.fields?.summary ?? raw.summary ?? ''),
    statusCategory: String(raw.fields?.status?.statusCategory?.name ?? raw.statusCategory ?? 'Unknown'),
    priority: raw.fields?.priority?.name ?? raw.priority ?? null
  };
}

export function coerceSyncStatus(raw) {
  return {
    authorized: raw?.authorized ?? false,
    ok: raw?.ok ?? true,
    error: raw?.error ?? null,
    lastSyncedAt: raw?.lastSyncedAt ?? raw?.last_synced_at ?? null,
    accountName: raw?.accountName ?? raw?.account_name ?? null,
    avatarUrl: raw?.avatarUrl ?? raw?.avatar_url ?? null
  };
}

export function isValidOAuthCallbackUrl(callbackUrl) {
  try {
    const parsed = new URL(callbackUrl);
    const code = parsed.searchParams.get('code');
    const state = parsed.searchParams.get('state');
    return Boolean(code && state);
  } catch {
    return false;
  }
}

export function toErrorMessage(error) {
  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }

  if (error && typeof error === 'object') {
    if (typeof error.message === 'string' && error.message.trim().length > 0) {
      return error.message;
    }

    if (typeof error.error === 'string' && error.error.trim().length > 0) {
      return error.error;
    }
  }

  return 'Unknown error';
}

async function invokeOrMock(command, args = {}) {
  const invoke = getInvoke();
  if (invoke) {
    return invoke(command, args);
  }

  if (command === 'fetch_assigned_issues') {
    return [
      {
        issue_id: '10001',
        issue_key: 'JIRA-123',
        summary: 'Build Tracklet MVP shell',
        status_category: 'In Progress'
      },
      {
        issue_id: '10002',
        issue_key: 'JIRA-456',
        summary: 'Implement Jira sync contract',
        status_category: 'To Do'
      }
    ];
  }

  if (command === 'jira_sync_status') {
    return {
      authorized: false,
      ok: true,
      error: null,
      last_synced_at: nowIso()
    };
  }

  if (command === 'get_cached_issues') {
    return [];
  }

  if (command === 'begin_jira_authorization') {
    return 'https://auth.atlassian.com/authorize';
  }

  if (command === 'complete_jira_authorization') {
    if (!isValidOAuthCallbackUrl(args?.callback_url ?? args?.callbackUrl ?? '')) {
      throw new Error('Callback URL is missing OAuth code or state');
    }

    return {
      authorized: true,
      account_id: 'mock-account-id',
      site_url: 'https://example.atlassian.net'
    };
  }

  if (command === 'pending_jira_sites') {
    return [];
  }

  if (command === 'select_jira_site') {
    return {
      authorized: true,
      account_id: 'mock-account-id',
      site_url: 'https://example.atlassian.net'
    };
  }

  if (command === 'wait_for_oauth_callback') {
    return 'http://127.0.0.1:43823/callback?code=mock-code&state=tracklet-mock-state';
  }

  if (command === 'oauth_callback_status') {
    return {
      pending: false,
      callback_url: null,
      error: null
    };
  }

  if (command === 'jira_disconnect') {
    return null;
  }

  if (command === 'open_external_url') {
    return null;
  }

  if (command === 'set_tray_timer_badge') {
    return null;
  }

  throw new Error(`No mock response for command: ${command}`);
}

export async function beginAuthorization() {
  return invokeOrMock('begin_jira_authorization');
}

export async function openAuthorizationUrl(url) {
  if (getInvoke()) {
    await invokeOrMock('open_external_url', { url });
    return;
  }

  globalThis?.open?.(url, '_blank', 'noopener,noreferrer');
}

export async function completeAuthorization(callbackUrl = '') {
  return invokeOrMock('complete_jira_authorization', { callbackUrl });
}

export async function getPendingJiraSites() {
  const sites = await invokeOrMock('pending_jira_sites');
  return (sites ?? []).map((site) => ({
    cloudId: String(site.cloud_id ?? site.cloudId ?? ''),
    siteUrl: String(site.site_url ?? site.siteUrl ?? '')
  }));
}

export async function selectJiraSite(cloudId) {
  return invokeOrMock('select_jira_site', { cloudId });
}

export async function waitForAuthorizationCallback(timeoutMs = 180000) {
  return invokeOrMock('wait_for_oauth_callback', { timeoutMs });
}

export async function oauthCallbackStatus() {
  return invokeOrMock('oauth_callback_status');
}

export async function fetchAssignedIssues() {
  const issues = await invokeOrMock('fetch_assigned_issues');
  return issues.map((issue) =>
    normalizeIssue({
      id: issue.issue_id ?? issue.issueId,
      key: issue.issue_key ?? issue.issueKey,
      summary: issue.summary,
      statusCategory: issue.status_category ?? issue.statusCategory,
      priority: issue.priority ?? null
    })
  );
}

export async function getCachedIssues() {
  const issues = await invokeOrMock('get_cached_issues');
  return (issues ?? []).map((issue) =>
    normalizeIssue({
      id: issue.issue_id ?? issue.issueId,
      key: issue.issue_key ?? issue.issueKey,
      summary: issue.summary,
      statusCategory: issue.status_category ?? issue.statusCategory,
      priority: issue.priority ?? null
    })
  );
}

export async function disconnectJira() {
  return invokeOrMock('jira_disconnect');
}

export async function getSyncStatus() {
  return coerceSyncStatus(await invokeOrMock('jira_sync_status'));
}

export async function timerSnapshot() {
  return invokeOrMock('timer_snapshot');
}

export async function startTimer(issue, at = undefined) {
  const issuePayload = {
    issue_id: String(issue?.issue_id ?? issue?.issueId ?? ''),
    issue_key: String(issue?.issue_key ?? issue?.issueKey ?? ''),
    summary: String(issue?.summary ?? '')
  };

  return invokeOrMock('start_timer', {
    issue: issuePayload,
    at: at ?? nowIso()
  });
}

export async function pauseTimer(at = undefined) {
  return invokeOrMock('pause_timer', {
    at: at ?? nowIso(),
    reason: 'manual'
  });
}

export async function resumeTimer(at = undefined) {
  return invokeOrMock('resume_timer', {
    at: at ?? nowIso()
  });
}

export async function stopTimer(at = undefined) {
  return invokeOrMock('stop_timer', {
    at: at ?? nowIso(),
    reason: 'manual_stop'
  });
}

export async function setTrayTimerBadge(pngDataUrl, timerLabel) {
  return invokeOrMock('set_tray_timer_badge', {
    pngDataUrl,
    timerLabel
  });
}
