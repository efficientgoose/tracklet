import { useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClock, faXmark } from '@fortawesome/free-solid-svg-icons';
import {
  beginAuthorization,
  completeAuthorization,
  fetchAssignedIssues,
  getPendingJiraSites,
  getSyncStatus,
  isValidOAuthCallbackUrl,
  openAuthorizationUrl,
  pauseTimer,
  resumeTimer,
  selectJiraSite,
  setTrayTimerBadge,
  startTimer,
  stopTimer,
  timerSnapshot,
  toErrorMessage,
  waitForAuthorizationCallback
} from './api.js';
import { activeStatusLabel, aggregateAnalytics, formatDuration, normalizeSnapshot } from './state.js';

type ActiveTab = 'timer' | 'analytics';

type Issue = {
  issueId: string;
  issueKey: string;
  summary: string;
  statusCategory: string;
};

type Snapshot = {
  activeSession: any;
  completedSessions: any[];
};

const EMPTY_SNAPSHOT: Snapshot = {
  activeSession: null,
  completedSessions: []
};
const LOCAL_FALLBACK_ISSUE = {
  issueId: 'local-session',
  issueKey: 'LOCAL',
  summary: 'Local focus session'
};
const MAX_MINUTES = 120;
const COUNTDOWN_TICK_MS = 1000;
const SLEEP_GAP_THRESHOLD_MS = 5000;
const MENU_BADGE_COLOR = '#1868DB';
const MENU_BADGE_RADIUS = 5;
const MENU_BADGE_HEIGHT = 24;
const MENU_BADGE_HORIZONTAL_PADDING = 10;
const MENU_BADGE_FONT = '600 16px "Inter"';

function issueOptionLabel(issue: Pick<Issue, 'issueKey' | 'summary'>) {
  return `${issue.issueKey} - ${issue.summary}`;
}

function buildCustomIssue(taskName: string): Issue {
  const summary = taskName.trim().replace(/\s+/g, ' ');
  const slug = summary
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return {
    issueId: `custom-${slug || 'task'}`,
    issueKey: summary,
    summary,
    statusCategory: 'Custom'
  };
}

function findIssueByTaskInput(inputValue: string, pool: Issue[]) {
  const normalized = inputValue.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return (
    pool.find((issue) => issueOptionLabel(issue).toLowerCase() === normalized) ??
    pool.find((issue) => issue.issueKey.toLowerCase() === normalized || issue.summary.toLowerCase() === normalized) ??
    null
  );
}

function formatMinutesValue(value: number) {
  if (value < 10) {
    return String(value).padStart(2, '0');
  }

  return String(value);
}

function drawRoundedRect(context: CanvasRenderingContext2D, width: number, height: number, radius: number) {
  const clampedRadius = Math.min(radius, width / 2, height / 2);

  context.beginPath();
  context.moveTo(clampedRadius, 0);
  context.lineTo(width - clampedRadius, 0);
  context.quadraticCurveTo(width, 0, width, clampedRadius);
  context.lineTo(width, height - clampedRadius);
  context.quadraticCurveTo(width, height, width - clampedRadius, height);
  context.lineTo(clampedRadius, height);
  context.quadraticCurveTo(0, height, 0, height - clampedRadius);
  context.lineTo(0, clampedRadius);
  context.quadraticCurveTo(0, 0, clampedRadius, 0);
  context.closePath();
}

function renderTrayTimerBadge(timerLabel: string) {
  if (!globalThis?.document) {
    return null;
  }

  const measurementCanvas = globalThis.document.createElement('canvas');
  const measurementContext = measurementCanvas.getContext('2d');
  if (!measurementContext) {
    return null;
  }

  measurementContext.font = MENU_BADGE_FONT;
  const textWidth = Math.ceil(measurementContext.measureText(timerLabel).width);
  const badgeWidth = Math.max(52, textWidth + MENU_BADGE_HORIZONTAL_PADDING * 2);
  const devicePixelRatio = Math.max(1, Math.ceil(globalThis.devicePixelRatio || 1));

  const canvas = globalThis.document.createElement('canvas');
  canvas.width = badgeWidth * devicePixelRatio;
  canvas.height = MENU_BADGE_HEIGHT * devicePixelRatio;
  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }

  context.scale(devicePixelRatio, devicePixelRatio);
  context.fillStyle = MENU_BADGE_COLOR;
  drawRoundedRect(context, badgeWidth, MENU_BADGE_HEIGHT, MENU_BADGE_RADIUS);
  context.fill();

  context.fillStyle = '#ffffff';
  context.font = MENU_BADGE_FONT;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(timerLabel, badgeWidth / 2, MENU_BADGE_HEIGHT / 2 + 0.25);

  return canvas.toDataURL('image/png');
}

const byPrefixAndName = {
  fas: {
    clock: faClock
  }
} as const;

export default function App() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY_SNAPSHOT);
  const [activeTab, setActiveTab] = useState<ActiveTab>('timer');
  const [selectedIssueId, setSelectedIssueId] = useState('');
  const [taskInput, setTaskInput] = useState('');
  const [isTaskDropdownOpen, setIsTaskDropdownOpen] = useState(false);
  const [syncMessage, setSyncMessage] = useState('Sync: Not authorized with Jira');
  const [syncWarning, setSyncWarning] = useState(false);
  const [authInProgress, setAuthInProgress] = useState(false);
  const [jiraAuthorized, setJiraAuthorized] = useState(false);
  const [isAuthorizeSectionVisible, setIsAuthorizeSectionVisible] = useState(true);
  const [nowIso, setNowIso] = useState(new Date().toISOString());
  const [durationMinutes, setDurationMinutes] = useState('25');
  const [durationSeconds, setDurationSeconds] = useState('00');
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [isCountdownRunning, setIsCountdownRunning] = useState(false);
  const [isTrayFontReady, setIsTrayFontReady] = useState(false);
  const autoStoppingRef = useRef(false);
  const lastCountdownTickMsRef = useRef<number | null>(null);
  const sleepTransitionInFlightRef = useRef(false);
  const latestTrayLabelRef = useRef('');

  const selectedIssue = useMemo(
    () => issues.find((issue) => issue.issueId === selectedIssueId) ?? null,
    [issues, selectedIssueId]
  );
  const filteredIssues = useMemo(() => {
    const query = taskInput.trim().toLowerCase();
    if (!query) {
      return issues;
    }

    return issues.filter((issue) => {
      const label = issueOptionLabel(issue).toLowerCase();
      return label.includes(query) || issue.issueKey.toLowerCase().includes(query) || issue.summary.toLowerCase().includes(query);
    });
  }, [issues, taskInput]);

  const activeLabel = useMemo(() => activeStatusLabel(snapshot, nowIso), [snapshot, nowIso]);
  const analyticsRows = useMemo(() => aggregateAnalytics(snapshot, nowIso), [snapshot, nowIso]);

  const active = snapshot.activeSession;
  const customTaskSummary = taskInput.trim();
  const showCreateTaskOption = customTaskSummary.length > 0 && !findIssueByTaskInput(customTaskSummary, issues);
  const normalizedMinutes = Number.parseInt(normalizeMinutesValue(durationMinutes), 10);
  const normalizedSeconds = Number.parseInt(normalizeDurationValue(durationSeconds, 59) || '00', 10);
  const totalInputSeconds = normalizedMinutes * 60 + normalizedSeconds;
  const trayTimerLabel = `${formatMinutesValue(normalizedMinutes)}:${String(normalizedSeconds).padStart(2, '0')}`;
  const canStart = !active && totalInputSeconds > 0;

  useEffect(() => {
    const pollHandle = setInterval(() => {
      setNowIso(new Date().toISOString());
    }, 1000);

    return () => {
      clearInterval(pollHandle);
    };
  }, []);

  useEffect(() => {
    if (!isCountdownRunning) {
      lastCountdownTickMsRef.current = null;
      sleepTransitionInFlightRef.current = false;
      return;
    }

    lastCountdownTickMsRef.current = Date.now();

    const tickHandle = setInterval(() => {
      const nowMs = Date.now();
      const previousTickMs = lastCountdownTickMsRef.current ?? nowMs;
      const gapMs = nowMs - previousTickMs;
      lastCountdownTickMsRef.current = nowMs;

      if (gapMs > SLEEP_GAP_THRESHOLD_MS && !sleepTransitionInFlightRef.current) {
        const inferredSleepStartMs = previousTickMs + COUNTDOWN_TICK_MS;
        sleepTransitionInFlightRef.current = true;

        void (async () => {
          try {
            await pauseTimer(new Date(inferredSleepStartMs).toISOString());
            await resumeTimer(new Date(nowMs).toISOString());
            await refreshSnapshot();
          } catch {
            // Ignore transition errors to avoid interrupting the local countdown.
          } finally {
            sleepTransitionInFlightRef.current = false;
          }
        })();
      }

      setRemainingSeconds((current) => {
        if (current === null) {
          return null;
        }

        return Math.max(0, current - 1);
      });
    }, 1000);

    return () => {
      clearInterval(tickHandle);
      lastCountdownTickMsRef.current = null;
    };
  }, [isCountdownRunning]);

  useEffect(() => {
    if (remainingSeconds === null) {
      return;
    }

    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    setDurationMinutes(formatMinutesValue(minutes));
    setDurationSeconds(String(seconds).padStart(2, '0'));
  }, [remainingSeconds]);

  useEffect(() => {
    if (!isCountdownRunning || remainingSeconds !== 0 || autoStoppingRef.current) {
      return;
    }

    autoStoppingRef.current = true;
    const stopWhenComplete = async () => {
      try {
        await stopTimer();
        await refreshSnapshot();
      } finally {
        setIsCountdownRunning(false);
        setRemainingSeconds(null);
        autoStoppingRef.current = false;
      }
    };

    void stopWhenComplete();
  }, [isCountdownRunning, remainingSeconds]);

  useEffect(() => {
    let cancelled = false;

    const fontSet = globalThis?.document?.fonts;
    if (!fontSet || typeof fontSet.load !== 'function') {
      setIsTrayFontReady(true);
      return () => {
        cancelled = true;
      };
    }

    const markTrayFontReady = () => {
      if (cancelled) {
        return;
      }

      latestTrayLabelRef.current = '';
      setIsTrayFontReady(true);
    };

    const waitForInter = async () => {
      try {
        await Promise.race([
          fontSet.load(MENU_BADGE_FONT, '00:00'),
          new Promise((resolve) => {
            setTimeout(resolve, 1500);
          })
        ]);
      } finally {
        markTrayFontReady();
      }
    };

    void waitForInter();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isTrayFontReady) {
      return;
    }

    if (trayTimerLabel === latestTrayLabelRef.current) {
      return;
    }

    latestTrayLabelRef.current = trayTimerLabel;
    const pngDataUrl = renderTrayTimerBadge(trayTimerLabel);
    if (!pngDataUrl) {
      return;
    }

    void setTrayTimerBadge(pngDataUrl, trayTimerLabel).catch(() => {
      latestTrayLabelRef.current = '';
    });
  }, [isTrayFontReady, trayTimerLabel]);

  async function refreshSyncStatus() {
    const syncStatus = await getSyncStatus();
    setJiraAuthorized(Boolean(syncStatus.authorized));

    const pieces = ['Sync', syncStatus.ok ? 'OK' : 'Error'];
    if (syncStatus.lastSyncedAt) {
      pieces.push(new Date(syncStatus.lastSyncedAt).toLocaleTimeString());
    }

    if (syncStatus.error) {
      pieces.push(syncStatus.error);
      setSyncWarning(true);
    } else {
      setSyncWarning(false);
    }

    setSyncMessage(pieces.join(': '));
  }

  async function refreshSnapshot() {
    setSnapshot(normalizeSnapshot(await timerSnapshot()));
  }

  async function refreshIssues() {
    const fetchedIssues = await fetchAssignedIssues();
    setIssues(fetchedIssues);
    const matchedFromInput = findIssueByTaskInput(taskInput, fetchedIssues);

    setSelectedIssueId((current) => {
      if (current && fetchedIssues.some((issue) => issue.issueId === current)) {
        return current;
      }
      return matchedFromInput?.issueId ?? '';
    });
  }

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const fetchedIssues = await fetchAssignedIssues();
      if (cancelled) {
        return;
      }

      setIssues(fetchedIssues);
      const matchedFromInput = findIssueByTaskInput(taskInput, fetchedIssues);
      setSelectedIssueId((current) => {
        if (current && fetchedIssues.some((issue) => issue.issueId === current)) {
          return current;
        }
        return matchedFromInput?.issueId ?? '';
      });

      await refreshSnapshot();
      await refreshSyncStatus();
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  async function resolvePendingSiteSelection() {
    const options = await getPendingJiraSites();
    if (options.length === 0) {
      return false;
    }

    if (!globalThis?.prompt) {
      throw new Error(
        `Multiple Jira sites are available. Select one by setting JIRA_CLOUD_ID in .env. Options: ${options
          .map((site) => `${site.cloudId} (${site.siteUrl})`)
          .join(', ')}`
      );
    }

    const choices = options.map((site, index) => `${index + 1}. ${site.siteUrl}`).join('\n');
    const input = globalThis.prompt(
      `Select the Jira site to use:\n${choices}\n\nEnter number (1-${options.length})`,
      '1'
    );

    if (!input) {
      throw new Error('Jira site selection was cancelled');
    }

    const selectedIndex = Number.parseInt(input, 10) - 1;
    if (Number.isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= options.length) {
      throw new Error('Invalid Jira site selection');
    }

    await selectJiraSite(options[selectedIndex].cloudId);
    return true;
  }

  async function handleAuthorize() {
    if (authInProgress) {
      return;
    }

    setAuthInProgress(true);

    try {
      const url = await beginAuthorization();
      await openAuthorizationUrl(url);
      setSyncWarning(false);
      setSyncMessage('Sync: Authorization opened, waiting for Jira callback...');

      const callbackUrl = await waitForAuthorizationCallback();
      if (!isValidOAuthCallbackUrl(callbackUrl)) {
        throw new Error('Received callback URL without OAuth code/state');
      }

      let completionError: unknown = null;
      try {
        await completeAuthorization(callbackUrl);
      } catch (error) {
        completionError = error;
      }

      if (completionError) {
        const resolved = await resolvePendingSiteSelection();
        if (!resolved) {
          throw completionError;
        }
      }

      await refreshIssues();
      await refreshSyncStatus();
    } catch (error) {
      setSyncWarning(true);
      setSyncMessage(`Sync: Error: ${toErrorMessage(error)}`);
    } finally {
      setAuthInProgress(false);
    }
  }

  async function handlePrimaryTimerAction() {
    if (active) {
      await stopTimer();
      await refreshSnapshot();
      setIsCountdownRunning(false);
      setRemainingSeconds(null);
      return;
    }

    if (totalInputSeconds <= 0) {
      return;
    }

    const issueToStart =
      selectedIssue ?? (customTaskSummary ? buildCustomIssue(customTaskSummary) : LOCAL_FALLBACK_ISSUE);
    await startTimer(issueToStart);
    await refreshSnapshot();
    setRemainingSeconds(totalInputSeconds);
    setIsCountdownRunning(true);
  }

  function normalizeDurationValue(value: string, max: number) {
    const digits = value.replace(/\D/g, '').slice(0, 2);
    if (digits.length === 0) {
      return '';
    }

    const parsed = Number.parseInt(digits, 10);
    if (Number.isNaN(parsed)) {
      return '';
    }

    const clamped = Math.max(0, Math.min(max, parsed));
    return String(clamped).padStart(2, '0');
  }

  function normalizeMinutesValue(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 3);
    if (digits.length === 0) {
      return '00';
    }

    const parsed = Number.parseInt(digits, 10);
    if (Number.isNaN(parsed)) {
      return '00';
    }

    return formatMinutesValue(Math.max(0, Math.min(MAX_MINUTES, parsed)));
  }

  function sanitizeMinutesInput(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 3);
    if (digits.length === 0) {
      return '';
    }

    const parsed = Number.parseInt(digits, 10);
    if (Number.isNaN(parsed)) {
      return '';
    }

    return formatMinutesValue(Math.min(MAX_MINUTES, parsed));
  }

  function adjustMinutes(delta: number) {
    const current = Number.parseInt(normalizeMinutesValue(durationMinutes), 10);
    const next = Math.max(0, Math.min(MAX_MINUTES, current + delta));
    setDurationMinutes(formatMinutesValue(next));
  }

  function openTaskDropdown() {
    setIsTaskDropdownOpen(true);
    void refreshIssues();
  }

  function closeTaskDropdown() {
    setIsTaskDropdownOpen(false);
  }

  const jiraStatusMessage = jiraAuthorized
    ? 'You are connected with Jira.'
    : 'You are not yet connected with Jira.';

  return (
    <main className={`app-shell ${isAuthorizeSectionVisible ? '' : 'status-hidden'}`} aria-label="Tracklet desktop app">
      {isAuthorizeSectionVisible && (
        <header className="status-card">
          <button
            className="status-close-btn"
            type="button"
            aria-label="Close authorize section"
            title="Close authorize section"
            onClick={() => setIsAuthorizeSectionVisible(false)}
          >
            <FontAwesomeIcon className="status-close-icon" icon={faXmark} />
          </button>
          <h1 className="status-title">TRACKLET</h1>
          <p className="status-copy">{jiraStatusMessage}</p>
          {!jiraAuthorized && (
            <button
              className="connect-btn"
              type="button"
              aria-label="Authorize Jira"
              title="Authorize Jira"
              onClick={handleAuthorize}
              disabled={authInProgress}
            >
              {authInProgress ? 'Connecting...' : 'Connect Jira'}
            </button>
          )}
          {jiraAuthorized ? (
            <p id="syncLabel" className={`sync-copy ${syncWarning ? 'warning' : ''}`}>
              {syncMessage}
            </p>
          ) : null}
        </header>
      )}

      <nav className="tab-strip" data-active={activeTab} aria-label="Panel sections">
        <span className="tab-indicator" aria-hidden="true" />
        <button
          id="timerTab"
          className={`tab-btn ${activeTab === 'timer' ? 'is-active' : ''}`}
          type="button"
          role="tab"
          aria-selected={activeTab === 'timer' ? 'true' : 'false'}
          aria-controls="timerView"
          onClick={() => setActiveTab('timer')}
        >
          TIMER
        </button>
        <button
          id="analyticsTab"
          className={`tab-btn ${activeTab === 'analytics' ? 'is-active' : ''}`}
          type="button"
          role="tab"
          aria-selected={activeTab === 'analytics' ? 'true' : 'false'}
          aria-controls="analyticsView"
          onClick={() => setActiveTab('analytics')}
        >
          ANALYTICS
        </button>
      </nav>

      <section
        id="timerView"
        className="panel timer-panel"
        role="tabpanel"
        aria-labelledby="timerTab"
        hidden={activeTab !== 'timer'}
      >
        <p className="duration-hint">Select a task to start the timer</p>

        <div id="issueSelectContainer" className="ticket-field">
          <input
            id="issueSelect"
            className="ticket-select"
            type="text"
            aria-label="Select or type task"
            placeholder="Select a ticket or type custom task"
            value={taskInput}
            onFocus={() => {
              setIsTaskDropdownOpen(true);
              void refreshIssues();
            }}
            onClick={openTaskDropdown}
            onBlur={() => {
              requestAnimationFrame(() => {
                const activeElement = globalThis?.document?.activeElement;
                if (activeElement instanceof HTMLElement && activeElement.closest('#issueSelectContainer')) {
                  return;
                }
                closeTaskDropdown();
              });
            }}
            onChange={(event) => {
              const value = event.target.value;
              setTaskInput(value);
              const matchedIssue = findIssueByTaskInput(value, issues);
              setSelectedIssueId(matchedIssue?.issueId ?? '');
              setIsTaskDropdownOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                if (!taskInput.trim()) {
                  return;
                }

                const matchedIssue = findIssueByTaskInput(taskInput.trim(), issues);
                if (matchedIssue) {
                  setSelectedIssueId(matchedIssue.issueId);
                  setTaskInput(issueOptionLabel(matchedIssue));
                } else {
                  setSelectedIssueId('');
                  setTaskInput(taskInput.trim());
                }
                closeTaskDropdown();
                return;
              }

              if (event.key === 'Escape') {
                closeTaskDropdown();
              }
            }}
            disabled={Boolean(active)}
          />
          <span className="ticket-caret" aria-hidden="true">
            ▾
          </span>
          {isTaskDropdownOpen && (
            <div className="ticket-dropdown" role="listbox" aria-label="Jira tickets">
              {showCreateTaskOption ? (
                <button
                  type="button"
                  className="ticket-option"
                  onMouseDown={(event) => {
                    event.preventDefault();
                  }}
                  onClick={() => {
                    setSelectedIssueId('');
                    setTaskInput(customTaskSummary);
                    closeTaskDropdown();
                  }}
                >
                  Create task &quot;{customTaskSummary}&quot;
                </button>
              ) : null}
              {!jiraAuthorized ? (
                <p className="ticket-state">Connect Jira to show tickets</p>
              ) : issues.length === 0 ? (
                <p className="ticket-state">No tickets found for this Jira account</p>
              ) : filteredIssues.length === 0 ? (
                <p className="ticket-state">No matching tickets</p>
              ) : (
                filteredIssues.map((issue) => (
                  <button
                    key={issue.issueId}
                    type="button"
                    className="ticket-option"
                    onMouseDown={(event) => {
                      event.preventDefault();
                    }}
                    onClick={() => {
                      setSelectedIssueId(issue.issueId);
                      setTaskInput(issueOptionLabel(issue));
                      closeTaskDropdown();
                    }}
                  >
                    {issueOptionLabel(issue)}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="duration-wrap" aria-label="Duration input">
          <button
            className="duration-adjust left"
            type="button"
            aria-label="Decrease minutes by 5"
            title="Decrease minutes by 5"
            onClick={() => adjustMinutes(-5)}
            disabled={Boolean(active)}
          >
            <span aria-hidden="true">◀</span>
          </button>
          <input
            className="duration-box"
            type="text"
            inputMode="numeric"
            maxLength={3}
            value={durationMinutes}
            onChange={(event) => setDurationMinutes(sanitizeMinutesInput(event.target.value))}
            onBlur={() => setDurationMinutes(normalizeMinutesValue(durationMinutes))}
            aria-label="Duration minutes"
            disabled={Boolean(active)}
          />
          <span className="duration-colon" aria-hidden="true">
            :
          </span>
          <input
            className="duration-box"
            type="text"
            inputMode="numeric"
            maxLength={2}
            value={durationSeconds}
            onChange={(event) => setDurationSeconds(event.target.value.replace(/\D/g, '').slice(0, 2))}
            onBlur={() => setDurationSeconds(normalizeDurationValue(durationSeconds, 59) || '00')}
            aria-label="Duration seconds"
            disabled={Boolean(active)}
          />
          <button
            className="duration-adjust right"
            type="button"
            aria-label="Increase minutes by 5"
            title="Increase minutes by 5"
            onClick={() => adjustMinutes(5)}
            disabled={Boolean(active)}
          >
            <span aria-hidden="true">▶</span>
          </button>
        </div>

        <button
          id="startBtn"
          className="start-btn"
          type="button"
          aria-label={active ? 'Stop timer' : 'Start timer'}
          title={active ? 'Stop timer' : 'Start timer'}
          onClick={handlePrimaryTimerAction}
          disabled={!active && !canStart}
        >
          <span className={`start-icon ${active ? 'stop' : 'play'}`} aria-hidden="true" />
          {active ? 'Stop Timer' : 'Start Timer'}
        </button>

        <p id="activeLabel" className="active-status">
          {active ? (
            activeLabel
          ) : (
            <span className="idle-row" title="No Active Timer" aria-label="No Active Timer">
              <FontAwesomeIcon icon={byPrefixAndName.fas['clock']} />
              No Active Timer
            </span>
          )}
        </p>
      </section>

      <section
        id="analyticsView"
        className="panel analytics-panel"
        role="tabpanel"
        aria-labelledby="analyticsTab"
        hidden={activeTab !== 'analytics'}
      >
        {analyticsRows.length === 0 ? (
          <p className="analytics-empty">Coming soon.</p>
        ) : (
          <ul id="analyticsList" className="analytics-list">
            {analyticsRows.map((row) => (
              <li key={row.issueKey}>
                <div>
                  <div className="analytics-issue">{row.issueKey}</div>
                  <div className="analytics-meta">{row.summary}</div>
                </div>
                <div className="analytics-duration">{formatDuration(row.totalSeconds)}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
