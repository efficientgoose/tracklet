import { Settings } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, Square, RotateCcw, ChevronDown, Search, X as XIcon, Trash2, User } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format, startOfDay, subDays, isWithinInterval } from 'date-fns';
import {
  beginAuthorization,
  completeAuthorization,
  fetchAssignedIssues,
  getCachedIssues,
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
import { aggregateAnalytics, formatDuration, normalizeSnapshot } from './state.js';

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
const RING_RADIUS = 85;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function formatMinutesValue(value: number) {
  if (value < 10) {
    return String(value).padStart(2, '0');
  }

  return String(value);
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

function renderTrayTimerBadge(timerLabel: string, color: string) {
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
  context.fillStyle = color;
  drawRoundedRect(context, badgeWidth, MENU_BADGE_HEIGHT, MENU_BADGE_RADIUS);
  context.fill();

  context.fillStyle = '#ffffff';
  context.font = MENU_BADGE_FONT;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(timerLabel, badgeWidth / 2, MENU_BADGE_HEIGHT / 2 + 0.25);

  return canvas.toDataURL('image/png');
}

function logoClock() {
  return (
    <svg className="logo-clock" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="5.5" stroke="white" strokeWidth="1.5" />
      <path d="M7 4.5V7.5L9 9" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function App() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY_SNAPSHOT);
  const [activeTab, setActiveTab] = useState<ActiveTab>('timer');
  const [selectedIssueId, setSelectedIssueId] = useState('');
  const [ticketSearch, setTicketSearch] = useState('');
  const [isTicketDropdownOpen, setIsTicketDropdownOpen] = useState(false);
  const [syncMessage, setSyncMessage] = useState('Sync: Not authorized with Jira');
  const [syncWarning, setSyncWarning] = useState(false);
  const [authInProgress, setAuthInProgress] = useState(false);
  const [awaitingCallback, setAwaitingCallback] = useState(false);
  const [jiraAuthorized, setJiraAuthorized] = useState(false);
  const [nowIso, setNowIso] = useState(new Date().toISOString());
  const [durationMinutes, setDurationMinutes] = useState('25');
  const [durationSeconds, setDurationSeconds] = useState('00');
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [isCountdownRunning, setIsCountdownRunning] = useState(false);
  const [isTrayFontReady, setIsTrayFontReady] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [focusDurationMinutes, setFocusDurationMinutes] = useState(25);
  const [breakDurationMinutes, setBreakDurationMinutes] = useState(5);
  const [autoStartBreak, setAutoStartBreak] = useState(false);
  const [autoStartFocus, setAutoStartFocus] = useState(false);
  const [timerType, setTimerType] = useState<'focus' | 'break'>('focus');
  const [timeRange, setTimeRange] = useState<'7d' | '30d'>('7d');
  const [isFetchingIssues, setIsFetchingIssues] = useState(false);
  const [jiraAvatarUrl, setJiraAvatarUrl] = useState<string | null>(null);
  const [jiraAccountName, setJiraAccountName] = useState<string | null>(null);

  const autoStoppingRef = useRef(false);
  const lastCountdownTickMsRef = useRef<number | null>(null);
  const sleepTransitionInFlightRef = useRef(false);
  const latestTrayLabelRef = useRef('');
  const activeCountdownTotalRef = useRef<number | null>(null);
  const ticketDropdownRef = useRef<HTMLDivElement | null>(null);

  const accentColor = timerType === 'focus' ? '#007AFF' : '#34c759';

  const selectedIssue = useMemo(() => issues.find((issue) => issue.issueId === selectedIssueId) ?? null, [issues, selectedIssueId]);
  const filteredIssues = useMemo(() => {
    const query = ticketSearch.trim().toLowerCase();
    if (!query) {
      return issues;
    }

    return issues.filter((issue) => {
      const label = `${issue.issueKey} ${issue.summary}`.toLowerCase();
      return label.includes(query);
    });
  }, [issues, ticketSearch]);

  const analyticsRows = useMemo(() => aggregateAnalytics(snapshot, nowIso), [snapshot, nowIso]);

  const active = snapshot.activeSession;
  const normalizedMinutes = Number.parseInt(normalizeMinutesValue(durationMinutes), 10);
  const normalizedSeconds = Number.parseInt(normalizeDurationValue(durationSeconds, 59) || '00', 10);
  const totalInputSeconds = normalizedMinutes * 60 + normalizedSeconds;
  const trayTimerLabel = `${formatMinutesValue(normalizedMinutes)}:${String(normalizedSeconds).padStart(2, '0')}`;
  const canStart = !active && totalInputSeconds > 0;

  const timerSeconds = active ? remainingSeconds ?? totalInputSeconds : totalInputSeconds;
  const timerMinutesDisplay = Math.floor(Math.max(0, timerSeconds) / 60);
  const timerSecondsDisplay = Math.max(0, timerSeconds) % 60;
  const formattedTime = `${String(timerMinutesDisplay).padStart(2, '0')}:${String(timerSecondsDisplay).padStart(2, '0')}`;

  const activeTotal = activeCountdownTotalRef.current ?? totalInputSeconds;
  const progress =
    active && activeTotal > 0
      ? Math.max(0, Math.min(1, (activeTotal - (remainingSeconds ?? 0)) / activeTotal))
      : 0;
  const strokeOffset = RING_CIRCUMFERENCE * (1 - progress);

  const totalTrackedSeconds = analyticsRows.reduce((acc, row) => acc + row.totalSeconds, 0);

  // Analytics chart data
  const days = timeRange === '7d' ? 7 : 30;
  const rangeStart = useMemo(() => startOfDay(subDays(new Date(), days)), [days]);
  const allSessions = useMemo(() => {
    const sessions = [...snapshot.completedSessions];
    if (snapshot.activeSession) sessions.push(snapshot.activeSession);
    return sessions;
  }, [snapshot]);
  const filteredSessions = useMemo(() => {
    return allSessions.filter((s: any) => {
      const startTime = new Date(s.startedAt || s.started_at).getTime();
      return isWithinInterval(startTime, { start: rangeStart, end: new Date() });
    });
  }, [allSessions, rangeStart]);

  const chartData = useMemo(() => {
    const bucketCount = Math.min(days, 7);
    const dailyData: { key: string; label: string; focus: number; break: number }[] = [];
    for (let i = bucketCount - 1; i >= 0; i--) {
      const d = subDays(new Date(), i);
      dailyData.push({ key: format(d, 'yyyy-MM-dd'), label: format(d, 'EEE'), focus: 0, break: 0 });
    }
    const keyMap = new Map(dailyData.map((d, idx) => [d.key, idx]));
    for (const session of filteredSessions) {
      const totalSecs = (session as any).segments?.reduce((acc: number, seg: any) => {
        const end = seg.endedAt || seg.ended_at || nowIso;
        return acc + Math.max(0, Math.floor((new Date(end).getTime() - new Date(seg.startedAt || seg.started_at).getTime()) / 1000));
      }, 0) ?? 0;
      const dateKey = format(new Date((session as any).startedAt || (session as any).started_at), 'yyyy-MM-dd');
      const idx = keyMap.get(dateKey);
      if (idx !== undefined) dailyData[idx].focus += totalSecs / 60;
    }
    return dailyData.map((d) => ({
      date: d.label, Focus: Math.round(d.focus), Break: Math.round(d.break),
    }));
  }, [filteredSessions, nowIso, days]);

  const totalBreakSeconds = 0;
  const pieData = [
    { name: 'Focus', value: Math.round(totalTrackedSeconds / 60), color: '#007AFF' },
    { name: 'Break', value: Math.round(totalBreakSeconds / 60), color: '#34c759' },
  ];

  useEffect(() => {
    const pollHandle = setInterval(() => {
      setNowIso(new Date().toISOString());
    }, 1000);

    return () => {
      clearInterval(pollHandle);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!ticketDropdownRef.current) {
        return;
      }

      if (!ticketDropdownRef.current.contains(event.target as Node)) {
        setIsTicketDropdownOpen(false);
        setTicketSearch('');
      }
    };

    globalThis.document?.addEventListener('mousedown', handleClickOutside);
    return () => {
      globalThis.document?.removeEventListener('mousedown', handleClickOutside);
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
    if (remainingSeconds === null || active) {
      return;
    }

    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    setDurationMinutes(formatMinutesValue(minutes));
    setDurationSeconds(String(seconds).padStart(2, '0'));
  }, [remainingSeconds, active]);

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
        activeCountdownTotalRef.current = null;
        autoStoppingRef.current = false;

        const nextType = timerType === 'focus' ? 'break' : 'focus';
        setTimerType(nextType);
        const nextDuration = nextType === 'focus' ? focusDurationMinutes : breakDurationMinutes;
        setDurationMinutes(formatMinutesValue(nextDuration));
        setDurationSeconds('00');
      }
    };

    void stopWhenComplete();
  }, [isCountdownRunning, remainingSeconds, timerType, focusDurationMinutes, breakDurationMinutes]);

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

    const trayLabel = active ? formattedTime : trayTimerLabel;
    if (trayLabel === latestTrayLabelRef.current) {
      return;
    }

    latestTrayLabelRef.current = trayLabel;
    const pngDataUrl = renderTrayTimerBadge(trayLabel, accentColor);
    if (!pngDataUrl) {
      return;
    }

    void setTrayTimerBadge(pngDataUrl, trayLabel).catch(() => {
      latestTrayLabelRef.current = '';
    });
  }, [isTrayFontReady, trayTimerLabel, formattedTime, accentColor, active]);

  async function refreshSyncStatus() {
    const syncStatus = await getSyncStatus();
    setJiraAuthorized(Boolean(syncStatus.authorized));
    setJiraAvatarUrl(syncStatus.avatarUrl ?? null);
    setJiraAccountName(syncStatus.accountName ?? null);

    const pieces = ['Sync', syncStatus.ok ? 'OK' : 'Error'];
    if (syncStatus.lastSyncedAt) {
      pieces.push(new Date(syncStatus.lastSyncedAt).toLocaleTimeString());
    }

    if (syncStatus.error) {
      pieces.push(syncStatus.error);

    } else {

    }

    setSyncMessage(pieces.join(': '));
  }

  async function refreshSnapshot() {
    setSnapshot(normalizeSnapshot(await timerSnapshot()));
  }

  async function refreshIssues() {
    const cached = await getCachedIssues();
    if (cached.length > 0) {
      setIssues(cached);
    }

    setIsFetchingIssues(true);
    try {
      const fetchedIssues = await fetchAssignedIssues();
      setIssues(fetchedIssues);

      setSelectedIssueId((current) => {
        if (current && fetchedIssues.some((issue) => issue.issueId === current)) {
          return current;
        }
        return '';
      });
    } finally {
      setIsFetchingIssues(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const cached = await getCachedIssues();
      if (cached.length > 0) {
        setIssues(cached);
      } else {
        setIsFetchingIssues(true);
      }

      try {
        const fetchedIssues = await fetchAssignedIssues();
        if (cancelled) {
          return;
        }

        setIssues(fetchedIssues);
      } catch (err) {
        console.error('Failed to fetch issues during bootstrap', err);
      } finally {
        setIsFetchingIssues(false);
      }

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
    if (authInProgress || awaitingCallback) {
      return;
    }

    setAuthInProgress(true);
    setSyncWarning(false);
    setSyncMessage('Sync: Authorization opened, waiting for Jira callback...');

    let url: string;
    try {
      url = await beginAuthorization();
    } catch (error) {
      setSyncWarning(true);
      setSyncMessage(`Sync: Error: ${toErrorMessage(error)}`);
      setAuthInProgress(false);
      return;
    }

    try {
      await openAuthorizationUrl(url);
    } catch (error) {
      setSyncWarning(true);
      setSyncMessage(`Sync: Error: ${toErrorMessage(error)}`);
      setAuthInProgress(false);
      return;
    }

    setAuthInProgress(false);
    setAwaitingCallback(true);

    void (async () => {
      try {
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
        setAwaitingCallback(false);
      }
    })();
  }

  async function handlePrimaryTimerAction() {
    if (active) {
      if (active.state === 'Paused') {
        await resumeTimer();
        setIsCountdownRunning(true);
      } else {
        await pauseTimer();
        setIsCountdownRunning(false);
      }
      await refreshSnapshot();
      return;
    }

    if (totalInputSeconds <= 0) {
      return;
    }

    const issueToStart = selectedIssue ?? LOCAL_FALLBACK_ISSUE;
    await startTimer(issueToStart);
    await refreshSnapshot();
    activeCountdownTotalRef.current = totalInputSeconds;
    setRemainingSeconds(totalInputSeconds);
    setIsCountdownRunning(true);
  }

  async function handleStopTimer() {
    if (!active) return;
    await stopTimer();
    await refreshSnapshot();
  }

  function handleResetDuration() {
    if (active) {
      return;
    }

    const duration = timerType === 'focus' ? focusDurationMinutes : breakDurationMinutes;
    setDurationMinutes(formatMinutesValue(duration));
    setDurationSeconds('00');
    setRemainingSeconds(null);
    activeCountdownTotalRef.current = null;
  }

  function saveSettings() {
    const focusClamped = Math.max(1, Math.min(MAX_MINUTES, focusDurationMinutes));
    const breakClamped = Math.max(1, Math.min(60, breakDurationMinutes));
    setFocusDurationMinutes(focusClamped);
    setBreakDurationMinutes(breakClamped);

    if (!active) {
      const duration = timerType === 'focus' ? focusClamped : breakClamped;
      setDurationMinutes(formatMinutesValue(duration));
      setDurationSeconds('00');
    }

    setIsSettingsOpen(false);
  }

  function handleClearAnalytics() {
    setSnapshot({ activeSession: snapshot.activeSession, completedSessions: [] });
  }

  return (
    <main className="app-root" aria-label="Tracklet desktop app">
      <div className="widget-shell">
        <header className="widget-header">
          <div className="header-left">
            <div className="logo-pill">{logoClock()}</div>
            <span className="app-title">Tracklet</span>
          </div>

          <div className="header-right">
            {!jiraAuthorized && (
              <button
                className="connect-inline-btn"
                type="button"
                onClick={handleAuthorize}
                disabled={authInProgress || awaitingCallback}
              >
                {authInProgress || awaitingCallback ? 'Connecting...' : 'Connect Jira'}
              </button>
            )}
            {jiraAuthorized && (
              <div className="header-avatar-container has-custom-tooltip">
                {jiraAvatarUrl ? (
                  <img src={jiraAvatarUrl} alt="User" className="user-avatar" />
                ) : (
                  <div className="user-avatar-fallback">
                    <User size={12} color="#8e8e93" />
                  </div>
                )}
                <div className="custom-tooltip">
                  {jiraAccountName ? `Authorized as ${jiraAccountName}` : 'Authorized'}
                </div>
              </div>
            )}
            <button 
              className="settings-btn has-custom-tooltip" 
              type="button" 
              onClick={() => setIsSettingsOpen(true)}
            >
              <Settings size={18} strokeWidth={2.2} />
              <div className="custom-tooltip">Settings</div>
            </button>
          </div>
        </header>


        <nav className="tab-strip" aria-label="Panel sections">
          <motion.span
            className="tab-indicator"
            initial={false}
            animate={{
              transform: activeTab === 'analytics' ? 'translateX(100%)' : 'translateX(0%)',
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 36 }}
            aria-hidden="true"
          />
          <button
            className={`tab-btn ${activeTab === 'timer' ? 'is-active' : ''}`}
            type="button"
            onClick={() => setActiveTab('timer')}
          >
            Timer
          </button>
          <button
            className={`tab-btn ${activeTab === 'analytics' ? 'is-active' : ''}`}
            type="button"
            onClick={() => setActiveTab('analytics')}
          >
            Analytics
          </button>
        </nav>

        <section className="content-shell">
          {activeTab === 'timer' ? (
            <div className="timer-panel">
              {/* Session type pill */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={timerType}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.2 }}
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: accentColor,
                      background: `${accentColor}12`,
                      borderRadius: 20,
                      padding: '4px 12px',
                    }}
                  >
                    {timerType === 'focus' ? 'Focus Session' : 'Break Time'}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Ring */}
              <div className="ring-wrap">
                <svg className="timer-ring" width="210" height="210" viewBox="0 0 210 210" aria-hidden="true">
                  <circle cx="105" cy="105" r={RING_RADIUS} className="ring-track" />
                  <motion.circle
                    cx="105"
                    cy="105"
                    r={RING_RADIUS}
                    fill="none"
                    stroke={accentColor}
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={RING_CIRCUMFERENCE}
                    animate={{ strokeDashoffset: strokeOffset }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </svg>
                <div className="ring-labels">
                  <span className="ring-time">{formattedTime}</span>
                  <span className="ring-subtitle">
                    {active ? 'Active session' : `${normalizedMinutes} min ${timerType}`}
                  </span>
                </div>
              </div>

              {/* Timer actions */}
              <div className="timer-actions">
                <button className="reset-btn" type="button" onClick={handleResetDuration} disabled={Boolean(active)} title="Reset">
                  <RotateCcw size={14} />
                </button>
                <button
                  className="start-btn"
                  type="button"
                  aria-label={active ? (active.state === 'Paused' ? 'Resume timer' : 'Pause timer') : 'Start timer'}
                  onClick={handlePrimaryTimerAction}
                  disabled={!active && !canStart}
                  style={{
                    background: accentColor,
                    boxShadow: (!active && !canStart) ? 'none' : `0 2px 8px ${accentColor}40`,
                  }}
                >
                  {active ? (
                    active.state === 'Paused' ? <Play size={13} fill="white" strokeWidth={0} /> : <Pause size={13} fill="white" strokeWidth={0} />
                  ) : (
                    <Play size={13} fill="white" strokeWidth={0} />
                  )}
                  {active ? (active.state === 'Paused' ? 'Resume' : 'Pause') : 'Start'}
                </button>
                {active && (
                  <button className="stop-btn" type="button" onClick={handleStopTimer} title="Stop session">
                    <Square size={13} fill="currentColor" strokeWidth={0} />
                  </button>
                )}
              </div>

              {/* Tracking card */}
              <AnimatePresence>
                {active && selectedIssue ? (
                  <motion.div
                    initial={{ opacity: 0, y: 4, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: 4, height: 0 }}
                    style={{ width: '100%' }}
                  >
                    <div
                      className="tracking-card"
                      style={{
                        background: `${accentColor}0d`,
                        borderColor: `${accentColor}22`,
                      }}
                    >
                      <span
                        className="tracking-dot"
                        style={{
                          background: accentColor,
                          ...(isCountdownRunning && { animation: 'pulse 1.5s infinite' }),
                        }}
                      />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p className="tracking-title" style={{ color: accentColor }}>Tracking</p>
                        <p className="tracking-text">
                          {selectedIssue.issueKey} &middot; {selectedIssue.summary}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {/* Ticket dropdown */}
              <div className="ticket-field" ref={ticketDropdownRef}>
                {!jiraAuthorized ? (
                  <button
                    className="ticket-trigger connect-ticket-btn"
                    type="button"
                    onClick={handleAuthorize}
                    disabled={authInProgress}
                  >
                    <span style={{ fontSize: 12, color: '#aeaeb2' }}>Connect Jira to track tickets</span>
                    <ChevronDown size={13} color="#aeaeb2" />
                  </button>
                ) : (
                  <>
                    <button
                      className={`ticket-trigger ${isTicketDropdownOpen ? 'is-open' : ''}`}
                      type="button"
                      onClick={() => {
                        setIsTicketDropdownOpen((open) => !open);
                        if (!isTicketDropdownOpen) {
                          void refreshIssues();
                        }
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, flex: 1, overflow: 'hidden' }}>
                        {selectedIssue ? (
                          <>
                            <span className="ticket-key">{selectedIssue.issueKey}</span>
                            <span className="ticket-trigger-text">{selectedIssue.summary}</span>
                          </>
                        ) : (
                          <span style={{ fontSize: 12, color: '#aeaeb2' }}>Select a ticket to track...</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginLeft: 6 }}>
                        {isFetchingIssues && !isTicketDropdownOpen && (
                          <span className="loading-spinner mini" style={{ marginRight: 2 }} />
                        )}
                        {selectedIssue && (
                          <button
                            type="button"
                            className="ticket-clear-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedIssueId('');
                            }}
                          >
                            <XIcon size={9} color="#636366" />
                          </button>
                        )}
                        <ChevronDown
                          size={13}
                          color="#8e8e93"
                          style={{
                            transform: isTicketDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s',
                          }}
                        />
                      </div>
                    </button>

                    <AnimatePresence>
                      {isTicketDropdownOpen ? (
                        <motion.div
                          className="ticket-dropdown is-up"
                          role="listbox"
                          aria-label="Jira tickets"
                          initial={{ opacity: 0, y: 4, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 4, scale: 0.98 }}
                          transition={{ duration: 0.15 }}
                        >
                          <div className="ticket-search-row">
                            <Search size={12} color="#aeaeb2" />
                            <input
                              className="ticket-search"
                              type="text"
                              value={ticketSearch}
                              onChange={(event) => setTicketSearch(event.target.value)}
                              placeholder="Search tickets..."
                              autoComplete="off"
                              autoCorrect="off"
                              autoCapitalize="off"
                              spellCheck="false"
                            />
                          </div>

                          <div className="ticket-options">
                            {isFetchingIssues && filteredIssues.length === 0 ? (
                              <div className="ticket-loading">
                                <span className="loading-spinner" />
                                <span>Loading tickets...</span>
                              </div>
                            ) : filteredIssues.length === 0 ? (
                              <p className="ticket-state">No tickets found for this Jira account</p>
                            ) : (
                              <>
                                {isFetchingIssues && (
                                  <div className="ticket-refreshing-overlay">
                                    <span className="loading-spinner mini" />
                                    <span>Refreshing...</span>
                                  </div>
                                )}
                                {filteredIssues.map((issue) => (
                                  <button
                                    key={issue.issueId}
                                    type="button"
                                    className={`ticket-option ${selectedIssueId === issue.issueId ? 'is-selected' : ''}`}
                                    onClick={() => {
                                      setSelectedIssueId(issue.issueId);
                                      setIsTicketDropdownOpen(false);
                                      setTicketSearch('');
                                    }}
                                  >
                                    <span className="ticket-key">{issue.issueKey}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <span className="ticket-summary">{issue.summary}</span>
                                      <p className="ticket-status">{issue.statusCategory}</p>
                                    </div>
                                    {selectedIssueId === issue.issueId && (
                                      <span style={{ fontSize: 14, color: '#007AFF', flexShrink: 0, marginTop: 1 }}>&#10003;</span>
                                    )}
                                  </button>
                                ))}
                              </>
                            )}
                          </div>

                          <div className="ticket-footer">
                            {filteredIssues.length} ticket{filteredIssues.length !== 1 ? 's' : ''}
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="analytics-panel">
              <div className="analytics-controls">
                <div className="range-picker">
                  <button
                    className={`range-btn ${timeRange === '7d' ? 'is-active' : ''}`}
                    type="button"
                    onClick={() => setTimeRange('7d')}
                  >
                    7 Days
                  </button>
                  <button
                    className={`range-btn ${timeRange === '30d' ? 'is-active' : ''}`}
                    type="button"
                    onClick={() => setTimeRange('30d')}
                  >
                    30 Days
                  </button>
                </div>
              </div>

              {/* Stat cards */}
              <div className="analytics-grid">
                <article className="stat-card">
                  <p className="stat-label">Focus Time</p>
                  <p className="stat-value">{formatDuration(totalTrackedSeconds)}</p>
                </article>
                <article className="stat-card">
                  <p className="stat-label">Sessions</p>
                  <p className="stat-value">{analyticsRows.length}</p>
                </article>
              </div>

              {/* Bar chart */}
              <div className="chart-card">
                <p className="chart-title">Activity (min)</p>
                <div style={{ height: 130 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} barGap={2}>
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 9, fill: '#aeaeb2' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: '#ffffff',
                          border: '1px solid rgba(0,0,0,0.09)',
                          borderRadius: 10,
                          fontSize: 11,
                          boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                        }}
                        cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                      />
                      <Bar dataKey="Focus" fill="#007AFF" radius={[4, 4, 0, 0]} barSize={14} />
                      <Bar dataKey="Break" fill="#34c759" radius={[4, 4, 0, 0]} barSize={14} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Distribution panel */}
              <div className="chart-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 12px' }}>
                <div>
                  <p className="chart-title">Distribution</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {pieData.map((entry) => (
                      <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: entry.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: '#636366' }}>{entry.name}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#1c1c1e', fontVariantNumeric: 'tabular-nums' }}>
                          {entry.value}m
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ width: 90, height: 90 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={24}
                        outerRadius={38}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Empty state */}
              {analyticsRows.length === 0 && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '20px 0',
                  gap: 6,
                }}>
                  <span style={{ fontSize: 28 }}>&#128202;</span>
                  <p style={{ fontSize: 13, fontWeight: 500, color: '#636366', margin: 0 }}>No sessions yet</p>
                  <p style={{ fontSize: 11, color: '#aeaeb2', margin: 0 }}>Complete a focus session to see analytics</p>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen ? (
          <>
            <motion.button
              className="settings-backdrop-overlay"
              type="button"
              aria-label="Close settings"
              onClick={() => setIsSettingsOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
            <motion.div
              className="settings-overlay"
              role="dialog"
              aria-modal="true"
              aria-label="Settings"
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ type: 'spring', stiffness: 450, damping: 34 }}
            >
              <div className="settings-modal" onClick={(event) => event.stopPropagation()}>
                <header className="settings-header">
                  <h2>Settings</h2>
                  <button className="settings-close" type="button" onClick={() => setIsSettingsOpen(false)}>
                    <XIcon size={12} strokeWidth={2.5} />
                  </button>
                </header>

                <div className="settings-body">
                  <p className="section-label">Duration</p>
                  <div className="settings-grid">
                    <div className="settings-card">
                      <span>Focus</span>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <button
                          className="stepper-btn"
                          type="button"
                          onClick={() => setFocusDurationMinutes(Math.max(1, focusDurationMinutes - 5))}
                        >
                          &#8722;
                        </button>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                          <span className="stepper-value">{focusDurationMinutes}</span>
                          <span className="stepper-unit">min</span>
                        </div>
                        <button
                          className="stepper-btn"
                          type="button"
                          onClick={() => setFocusDurationMinutes(Math.min(MAX_MINUTES, focusDurationMinutes + 5))}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="settings-card">
                      <span>Break</span>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <button
                          className="stepper-btn"
                          type="button"
                          onClick={() => setBreakDurationMinutes(Math.max(1, breakDurationMinutes - 5))}
                        >
                          &#8722;
                        </button>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                          <span className="stepper-value">{breakDurationMinutes}</span>
                          <span className="stepper-unit">min</span>
                        </div>
                        <button
                          className="stepper-btn"
                          type="button"
                          onClick={() => setBreakDurationMinutes(Math.min(60, breakDurationMinutes + 5))}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  <p className="section-label">Auto-start</p>
                  <div className="toggle-group">
                    <button
                      className="toggle-row"
                      type="button"
                      onClick={() => setAutoStartBreak((current) => !current)}
                    >
                      <span>Break timer</span>
                        <div
                          className="toggle-track"
                          style={{ background: autoStartBreak ? 'var(--brand)' : '#e5e5ea' }}
                        >
                        <motion.div
                          className="toggle-thumb"
                          animate={{ x: autoStartBreak ? 17 : 1 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                      </div>
                    </button>
                    <button
                      className="toggle-row"
                      type="button"
                      onClick={() => setAutoStartFocus((current) => !current)}
                    >
                      <span>Focus timer</span>
                        <div
                          className="toggle-track"
                          style={{ background: autoStartFocus ? 'var(--brand)' : '#e5e5ea' }}
                        >
                        <motion.div
                          className="toggle-thumb"
                          animate={{ x: autoStartFocus ? 17 : 1 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                      </div>
                    </button>
                  </div>

                  <button className="save-settings-btn" type="button" onClick={saveSettings}>
                    Save
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
