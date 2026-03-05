import { Settings } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, Square, FastForward, RotateCcw, ChevronDown, Search, X as XIcon, Trash2, User, LogOut, Moon, Sun, ChevronsUp, ChevronUp, Equal, ChevronDown as ChevronDownIcon, ChevronsDown, Leaf } from 'lucide-react';
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
  disconnectJira,
  waitForAuthorizationCallback
} from './api.js';
import { aggregateAnalytics, aggregateByDay, formatDuration, normalizeSnapshot } from './state.js';

type ActiveTab = 'timer' | 'analytics';

type Issue = {
  issueId: string;
  issueKey: string;
  summary: string;
  statusCategory: string;
  priority: string | null;
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
  summary: 'Untitled Task'
};

const BREAK_ISSUE = {
  issueId: 'break-session',
  issueKey: 'BREAK',
  summary: 'Break'
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

const FOCUS_QUOTES = [
  "Don't give up.",
  "Stay focused.",
  "You got this.",
  "Keep going.",
  "One step at a time.",
  "Make it count.",
  "Push through.",
  "Stay the course.",
  "Deep work pays off.",
  "Do it for future you.",
  "Progress, not perfection.",
  "Earned, not given.",
];

const BREAK_QUOTES = [
  "Take a breath.",
  "Rest up.",
  "You earned it.",
  "Step away.",
  "Recharge.",
  "Clear your mind.",
  "Stretch a little.",
  "Relax.",
  "Good work.",
  "Reset and return.",
  "Rest is progress.",
  "Enjoy the pause.",
];

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
  return <Leaf size={14} fill="white" color="white" strokeWidth={0} aria-hidden="true" />;
}

const STATUS_MAP: Record<string, { text: string; color: string; bg: string }> = {
  'to do':        { text: 'To Do',        color: '#007AFF', bg: '#007AFF18' },
  'open':         { text: 'Open',         color: '#007AFF', bg: '#007AFF18' },
  'backlog':      { text: 'Backlog',      color: '#007AFF', bg: '#007AFF18' },
  'in progress':  { text: 'In Progress',  color: '#f9a825', bg: '#f9a82518' },
  'in review':    { text: 'In Review',    color: '#9b59b6', bg: '#9b59b618' },
  'uat':          { text: 'UAT',          color: '#27ae60', bg: '#27ae6018' },
  'rfq':          { text: 'RFQ',          color: '#27ae60', bg: '#27ae6018' },
  'verified':     { text: 'Verified',     color: '#27ae60', bg: '#27ae6018' },
  'ready for qa': { text: 'Ready for QA', color: '#9b59b6', bg: '#9b59b618' },
  'in testing':   { text: 'In Testing',   color: '#9b59b6', bg: '#9b59b618' },
  'code review':  { text: 'Code Review',  color: '#9b59b6', bg: '#9b59b618' },
  'blocked':      { text: 'Blocked',      color: '#ff3b30', bg: '#ff3b3018' },
  'on hold':      { text: 'On Hold',      color: '#ff3b30', bg: '#ff3b3018' },
  'hold':         { text: 'Hold',         color: '#ff3b30', bg: '#ff3b3018' },
  'done':         { text: 'Done',         color: '#34c759', bg: '#34c75918' },
  'closed':       { text: 'Closed',       color: '#34c759', bg: '#34c75918' },
  'resolved':     { text: 'Resolved',     color: '#34c759', bg: '#34c75918' },
};

function StatusBadge({ status }: { status: string }) {
  const entry = STATUS_MAP[status.toLowerCase()] ?? { text: status, color: '#636366', bg: '#63636618' };
  return (
    <span style={{
      fontSize: 9,
      fontWeight: 600,
      letterSpacing: '0.02em',
      padding: '2px 6px',
      borderRadius: 5,
      background: entry.bg,
      color: entry.color,
      whiteSpace: 'nowrap',
    }}>
      {entry.text}
    </span>
  );
}

const PRIORITY_MAP: Record<string, { icon: React.ReactNode; bg: string }> = {
  highest: { icon: <ChevronsUp    size={12} color="#d32f2f" strokeWidth={2.5} />, bg: '#d32f2f15' },
  high:    { icon: <ChevronUp     size={12} color="#e57373" strokeWidth={2.5} />, bg: '#e5737315' },
  medium:  { icon: <Equal         size={12} color="#f9a825" strokeWidth={2.5} />, bg: '#f9a82515' },
  low:     { icon: <ChevronDownIcon size={12} color="#42a5f5" strokeWidth={2.5} />, bg: '#42a5f515' },
  lowest:  { icon: <ChevronsDown  size={12} color="#1565c0" strokeWidth={2.5} />, bg: '#1565c015' },
};

function PriorityIcon({ priority }: { priority: string | null }) {
  if (!priority) return null;
  const entry = PRIORITY_MAP[priority.toLowerCase()];
  if (!entry) return null;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 22,
      height: 22,
      borderRadius: 6,
      background: entry.bg,
      flexShrink: 0,
    }}>
      {entry.icon}
    </span>
  );
}

export default function App() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY_SNAPSHOT);
  const [activeTab, setActiveTab] = useState<ActiveTab>('timer');
  const [selectedIssueId, setSelectedIssueId] = useState('');
  const [ticketSearch, setTicketSearch] = useState('');
  const [isTicketDropdownOpen, setIsTicketDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [syncMessage, setSyncMessage] = useState('Sync: Not authorized with Jira');
  const [syncWarning, setSyncWarning] = useState(false);
  const [authInProgress, setAuthInProgress] = useState(false);
  const [awaitingCallback, setAwaitingCallback] = useState(false);
  const [jiraAuthorized, setJiraAuthorized] = useState(false);
  const [nowIso, setNowIso] = useState(new Date().toISOString());
  const [quoteIndex, setQuoteIndex] = useState(() => Math.floor(Math.random() * FOCUS_QUOTES.length));
  const [breakQuoteIndex, setBreakQuoteIndex] = useState(() => Math.floor(Math.random() * BREAK_QUOTES.length));
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('tracklet.darkMode');
    if (saved !== null) return saved === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [durationMinutes, setDurationMinutes] = useState(() => {
    const saved = localStorage.getItem('tracklet.focusDuration');
    const parsed = saved ? Number.parseInt(saved, 10) : NaN;
    const minutes = Number.isFinite(parsed) && parsed >= 1 && parsed <= MAX_MINUTES ? parsed : 25;
    return formatMinutesValue(minutes);
  });
  const [durationSeconds, setDurationSeconds] = useState('00');
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [isCountdownRunning, setIsCountdownRunning] = useState(false);
  const [isTrayFontReady, setIsTrayFontReady] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [focusDurationMinutes, setFocusDurationMinutes] = useState(() => {
    const saved = localStorage.getItem('tracklet.focusDuration');
    const parsed = saved ? Number.parseInt(saved, 10) : NaN;
    return Number.isFinite(parsed) && parsed >= 1 && parsed <= MAX_MINUTES ? parsed : 25;
  });
  const [breakDurationMinutes, setBreakDurationMinutes] = useState(() => {
    const saved = localStorage.getItem('tracklet.breakDuration');
    const parsed = saved ? Number.parseInt(saved, 10) : NaN;
    return Number.isFinite(parsed) && parsed >= 1 && parsed <= 60 ? parsed : 5;
  });
  const [autoStartBreak, setAutoStartBreak] = useState(false);
  const [autoStartFocus, setAutoStartFocus] = useState(false);
  const [timerType, setTimerType] = useState<'focus' | 'break'>('focus');
  const [timeRange, setTimeRange] = useState<'7d' | '30d'>('7d');
  const [isFetchingIssues, setIsFetchingIssues] = useState(false);
  const [jiraAvatarUrl, setJiraAvatarUrl] = useState<string | null>(null);
  const [jiraAccountName, setJiraAccountName] = useState<string | null>(null);
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);

  const autoStoppingRef = useRef(false);
  const lastCountdownTickMsRef = useRef<number | null>(null);
  const countdownEndMsRef = useRef(0);
  const sleepTransitionInFlightRef = useRef(false);
  const lastFocusIssueRef = useRef<{ issueKey: string; summary: string } | null>(null);
  const latestTrayLabelRef = useRef('');
  const activeCountdownTotalRef = useRef<number | null>(null);
  const ticketDropdownRef = useRef<HTMLDivElement | null>(null);
  const avatarMenuRef = useRef<HTMLDivElement | null>(null);
  const ticketOptionsRef = useRef<HTMLDivElement | null>(null);

  const accentColor = timerType === 'focus' ? '#007AFF' : '#34c759';

  const selectedIssue = useMemo(() => issues.find((issue) => issue.issueId === selectedIssueId) ?? null, [issues, selectedIssueId]);
  const filteredIssues = useMemo(() => {
    const STATUS_ORDER: Record<string, number> = {
      'in progress':  0,
      'to do':        1,
      'open':         1,
      'backlog':      1,
      'in review':    2,
      'ready for qa': 3,
      'uat':          4,
      'verified':     5,
    };

    const query = ticketSearch.trim().toLowerCase();
    const filtered = query
      ? issues.filter((issue) => `${issue.issueKey} ${issue.summary}`.toLowerCase().includes(query))
      : issues;

    return [...filtered].sort((a, b) => {
      const aOrder = STATUS_ORDER[a.statusCategory.toLowerCase()] ?? 99;
      const bOrder = STATUS_ORDER[b.statusCategory.toLowerCase()] ?? 99;
      return aOrder - bOrder;
    });
  }, [issues, ticketSearch]);

  // Reset highlight to first item whenever the filtered list or dropdown state changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredIssues, isTicketDropdownOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    const container = ticketOptionsRef.current;
    if (!container) return;
    const item = container.children[highlightedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex]);

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
  const dailyBreakdown = useMemo(() => aggregateByDay(snapshot, nowIso, days), [snapshot, nowIso, days]);
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
      const isBreak = (session as any).issueKey === 'BREAK';
      const totalSecs = (session as any).segments?.reduce((acc: number, seg: any) => {
        const end = seg.endedAt || seg.ended_at || nowIso;
        return acc + Math.max(0, Math.floor((new Date(end).getTime() - new Date(seg.startedAt || seg.started_at).getTime()) / 1000));
      }, 0) ?? 0;
      const dateKey = format(new Date((session as any).startedAt || (session as any).started_at), 'yyyy-MM-dd');
      const idx = keyMap.get(dateKey);
      if (idx !== undefined) {
        if (isBreak) {
          dailyData[idx].break += totalSecs / 60;
        } else {
          dailyData[idx].focus += totalSecs / 60;
        }
      }
    }
    return dailyData.map((d) => ({
      date: d.label, Focus: Math.round(d.focus), Break: Math.round(d.break),
    }));
  }, [filteredSessions, nowIso, days]);

  const totalBreakSeconds = useMemo(() => {
    return allSessions
      .filter((s: any) => s.issueKey === 'BREAK')
      .reduce((acc: number, s: any) => {
        return acc + (s.segments ?? []).reduce((a: number, seg: any) => {
          const end = seg.endedAt || nowIso;
          return a + Math.max(0, Math.floor((new Date(end).getTime() - new Date(seg.startedAt).getTime()) / 1000));
        }, 0);
      }, 0);
  }, [allSessions, nowIso]);

  const totalFocusSeconds = useMemo(() => {
    return allSessions
      .filter((s: any) => s.issueKey !== 'BREAK')
      .reduce((acc: number, s: any) => {
        return acc + (s.segments ?? []).reduce((a: number, seg: any) => {
          const end = seg.endedAt || nowIso;
          return a + Math.max(0, Math.floor((new Date(end).getTime() - new Date(seg.startedAt).getTime()) / 1000));
        }, 0);
      }, 0);
  }, [allSessions, nowIso]);

  const pieData = [
    { name: 'Focus', value: Math.round(totalFocusSeconds / 60), color: '#007AFF' },
    { name: 'Break', value: Math.round(totalBreakSeconds / 60), color: '#34c759' },
  ];

  useEffect(() => {
    if (activeTab !== 'analytics') return;

    setNowIso(new Date().toISOString());
    const pollHandle = setInterval(() => {
      setNowIso(new Date().toISOString());
    }, 10_000);

    return () => {
      clearInterval(pollHandle);
    };
  }, [activeTab]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ticketDropdownRef.current && !ticketDropdownRef.current.contains(event.target as Node)) {
        setIsTicketDropdownOpen(false);
        setTicketSearch('');
      }
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(event.target as Node)) {
        setIsAvatarMenuOpen(false);
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

    // Compute the wall-clock end time from the current remaining seconds.
    countdownEndMsRef.current = Date.now() + (remainingSeconds ?? totalInputSeconds) * 1000;
    lastCountdownTickMsRef.current = Date.now();

    const tickHandle = setInterval(() => {
      const nowMs = Date.now();
      const previousTickMs = lastCountdownTickMsRef.current ?? nowMs;
      const gapMs = nowMs - previousTickMs;

      if (gapMs > SLEEP_GAP_THRESHOLD_MS && !sleepTransitionInFlightRef.current) {
        const inferredSleepStartMs = previousTickMs + COUNTDOWN_TICK_MS;
        const sleepDurationMs = nowMs - inferredSleepStartMs;
        // Timer should not count during sleep — push end time forward.
        countdownEndMsRef.current += sleepDurationMs;
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

      lastCountdownTickMsRef.current = nowMs;
      // Derive remaining time from wall clock — immune to interval jitter.
      const remaining = Math.max(0, Math.ceil((countdownEndMsRef.current - nowMs) / 1000));
      setRemainingSeconds(remaining);
    }, COUNTDOWN_TICK_MS);

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

  useEffect(() => {
    const tauriEvent = (globalThis as any)?.window?.__TAURI__?.event;
    if (!tauriEvent) return;

    let unlisten: (() => void) | null = null;
    tauriEvent.listen('timer-state-changed', () => {
      refreshSnapshot();
    }).then((fn: () => void) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    localStorage.setItem('tracklet.darkMode', String(isDarkMode));
  }, [isDarkMode]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      if (localStorage.getItem('tracklet.darkMode') === null) {
        setIsDarkMode(e.matches);
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    localStorage.setItem('tracklet.focusDuration', String(focusDurationMinutes));
  }, [focusDurationMinutes]);

  useEffect(() => {
    localStorage.setItem('tracklet.breakDuration', String(breakDurationMinutes));
  }, [breakDurationMinutes]);

  useEffect(() => {
    const id = setInterval(() => {
      setQuoteIndex((i) => (i + 1) % FOCUS_QUOTES.length);
    }, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setBreakQuoteIndex((i) => (i + 1) % BREAK_QUOTES.length);
    }, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  async function refreshIssues() {
    const cached = await getCachedIssues();
    if (cached.length > 0) {
      setIssues(cached);
    }

    setIsFetchingIssues(true);
    try {
      const fetchedIssues = await fetchAssignedIssues();
      if (fetchedIssues.length > 0) {
        setIssues(fetchedIssues);
        setSelectedIssueId((current) => {
          if (current && fetchedIssues.some((issue) => issue.issueId === current)) {
            return current;
          }
          return '';
        });
      }
      await refreshSyncStatus();
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

        if (fetchedIssues.length > 0) {
          setIssues(fetchedIssues);
        }
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

  useEffect(() => {
    const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
    const id = setInterval(() => {
      fetchAssignedIssues()
        .then((fetched) => {
          if (fetched.length > 0) setIssues(fetched);
        })
        .catch(() => {});
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
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

    const focusIssue = selectedIssue ?? LOCAL_FALLBACK_ISSUE;
    const issueToStart = timerType === 'break' ? BREAK_ISSUE : focusIssue;
    if (timerType !== 'break') {
      lastFocusIssueRef.current = { issueKey: focusIssue.issueKey, summary: focusIssue.summary };
    }
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
    setIsCountdownRunning(false);
    setRemainingSeconds(null);
    activeCountdownTotalRef.current = null;
    const duration = timerType === 'focus' ? focusDurationMinutes : breakDurationMinutes;
    setDurationMinutes(formatMinutesValue(duration));
    setDurationSeconds('00');
  }

  async function handleSkipToNext() {
    if (active) {
      await stopTimer();
      await refreshSnapshot();
    }

    setIsCountdownRunning(false);
    setRemainingSeconds(null);
    activeCountdownTotalRef.current = null;

    const nextType = timerType === 'focus' ? 'break' : 'focus';
    setTimerType(nextType);
    setQuoteIndex(Math.floor(Math.random() * FOCUS_QUOTES.length));
    setBreakQuoteIndex(Math.floor(Math.random() * BREAK_QUOTES.length));
    const nextDuration = nextType === 'focus' ? focusDurationMinutes : breakDurationMinutes;
    setDurationMinutes(formatMinutesValue(nextDuration));
    setDurationSeconds('00');
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

  async function handleDisconnect() {
    try {
      await disconnectJira();
    } catch {
      // Ignore — clear frontend state regardless
    }
    setJiraAuthorized(false);
    setJiraAvatarUrl(null);
    setJiraAccountName(null);
    setIssues([]);
    setSelectedIssueId('');
    setIsAvatarMenuOpen(false);
    setSyncMessage('');
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
              <div className="avatar-menu-wrap" ref={avatarMenuRef}>
                <button
                  className="header-avatar-container has-custom-tooltip"
                  type="button"
                  onClick={() => setIsAvatarMenuOpen((open) => !open)}
                >
                  {jiraAvatarUrl ? (
                    <img src={jiraAvatarUrl} alt="User" className="user-avatar" />
                  ) : (
                    <div className="user-avatar-fallback">
                      <User size={12} color="#8e8e93" />
                    </div>
                  )}
                  {jiraAccountName && !isAvatarMenuOpen && (
                    <div className="custom-tooltip">Authorized as {jiraAccountName}</div>
                  )}
                </button>
                <AnimatePresence>
                  {isAvatarMenuOpen && (
                    <motion.div
                      className="avatar-dropdown"
                      initial={{ opacity: 0, y: -4, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.96 }}
                      transition={{ duration: 0.12 }}
                    >
                      <button
                        className="avatar-dropdown-item avatar-dropdown-item--neutral"
                        type="button"
                        onClick={(e) => {
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          const x = rect.left + rect.width / 2;
                          const y = rect.top + rect.height / 2;
                          const newDark = !isDarkMode;
                          document.documentElement.style.setProperty('--vt-x', `${x}px`);
                          document.documentElement.style.setProperty('--vt-y', `${y}px`);
                          const startVT = (document as any).startViewTransition?.bind(document);
                          if (!startVT) { setIsDarkMode(newDark); setIsAvatarMenuOpen(false); return; }
                          startVT(() => {
                            document.documentElement.setAttribute('data-theme', newDark ? 'dark' : 'light');
                            setIsDarkMode(newDark);
                            setIsAvatarMenuOpen(false);
                          });
                        }}
                      >
                        {isDarkMode ? <Sun size={12} /> : <Moon size={12} />}
                        <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
                      </button>
                      <button
                        className="avatar-dropdown-item"
                        type="button"
                        onClick={handleDisconnect}
                      >
                        <LogOut size={12} />
                        <span>Logout</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
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
                    {timerType === 'focus' ? FOCUS_QUOTES[quoteIndex] : BREAK_QUOTES[breakQuoteIndex]}
                  </span>
                </div>
              </div>

              {/* Timer actions */}
              <div className="timer-actions">
                <button className="reset-btn" type="button" onClick={() => void handleSkipToNext()} title={timerType === 'focus' ? 'Skip to Break' : 'Skip to Focus'}>
                  <FastForward size={14} strokeWidth={2.5} fill="currentColor" />
                </button>
                <button
                  className="start-btn"
                  type="button"
                  aria-label={active ? (active.state === 'Paused' ? 'Resume timer' : 'Pause timer') : 'Start timer'}
                  onClick={handlePrimaryTimerAction}
                  disabled={!active && !canStart}
                  style={{
                    ['--btn-accent' as any]: accentColor,
                    background: `${accentColor}22`,
                    color: accentColor,
                    boxShadow: 'none',
                  }}
                >
                  {active ? (
                    active.state === 'Paused' ? <Play size={13} fill={accentColor} strokeWidth={0} /> : <Pause size={13} fill={accentColor} strokeWidth={0} />
                  ) : (
                    <Play size={13} fill={accentColor} strokeWidth={0} />
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
                {active ? (
                  <motion.div
                    initial={{ opacity: 0, y: 4, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.15 }}
                    style={{ width: '100%', marginTop: 12 }}
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
                        <p className="tracking-title" style={{ color: accentColor }}>
                          {active.issueKey === 'BREAK' ? 'Break' : 'Tracking'}
                        </p>
                        <p className="tracking-text">
                          {(() => {
                            if (active.issueKey === 'BREAK') {
                              const last = lastFocusIssueRef.current;
                              if (last && last.issueKey !== 'LOCAL') return <>{last.issueKey} &middot; {last.summary}</>;
                              if (last) return <>{last.summary}</>;
                              return <>Break</>;
                            }
                            return <>{active.issueKey !== 'LOCAL' && <>{active.issueKey} &middot; </>}{active.summary}</>;
                          })()}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {/* Ticket dropdown */}
              {!active && <div className="ticket-field" ref={ticketDropdownRef}>
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
                        if (!isTicketDropdownOpen && issues.length === 0) {
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
                            <XIcon size={9} color="#ffffff" />
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
                              style={{ flex: 1 }}
                              type="text"
                              value={ticketSearch}
                              onChange={(event) => setTicketSearch(event.target.value)}
                              placeholder="Search tickets..."
                              autoComplete="off"
                              autoCorrect="off"
                              autoFocus
                              onKeyDown={(event) => {
                                if (event.key === 'ArrowDown') {
                                  event.preventDefault();
                                  setHighlightedIndex((i) => Math.min(i + 1, filteredIssues.length - 1));
                                } else if (event.key === 'ArrowUp') {
                                  event.preventDefault();
                                  setHighlightedIndex((i) => Math.max(i - 1, 0));
                                } else if (event.key === 'Enter') {
                                  const issue = filteredIssues[highlightedIndex];
                                  if (issue) {
                                    setSelectedIssueId(issue.issueId);
                                    setIsTicketDropdownOpen(false);
                                    setTicketSearch('');
                                  }
                                } else if (event.key === 'Escape') {
                                  setIsTicketDropdownOpen(false);
                                }
                              }}
                              autoCapitalize="off"
                              spellCheck="false"
                            />
                            <button
                              className="ticket-refresh-btn"
                              type="button"
                              title="Refresh tickets"
                              disabled={isFetchingIssues}
                              onClick={() => void refreshIssues()}
                            >
                              {isFetchingIssues
                                ? <span className="loading-spinner mini" />
                                : <RotateCcw size={11} strokeWidth={2.5} />}
                            </button>
                          </div>

                          <div className="ticket-options" ref={ticketOptionsRef}>
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
                                {filteredIssues.map((issue, index) => (
                                  <button
                                    key={issue.issueId}
                                    type="button"
                                    className={`ticket-option ${selectedIssueId === issue.issueId ? 'is-selected' : ''} ${highlightedIndex === index ? 'is-active' : ''}`}
                                    onClick={() => {
                                      setSelectedIssueId(issue.issueId);
                                      setIsTicketDropdownOpen(false);
                                      setTicketSearch('');
                                    }}
                                  >
                                    <span className="ticket-key">{issue.issueKey}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <span className="ticket-summary">{issue.summary}</span>
                                      <p className="ticket-status"><StatusBadge status={issue.statusCategory} /></p>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                      <PriorityIcon priority={issue.priority} />
                                      {selectedIssueId === issue.issueId && (
                                        <span style={{ fontSize: 14, color: '#007AFF' }}>&#10003;</span>
                                      )}
                                    </div>
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
              </div>}
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
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{entry.name}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
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
                        isAnimationActive={true}
                        animationBegin={0}
                        animationDuration={700}
                        animationEasing="ease-out"
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Daily breakdown */}
              {dailyBreakdown.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0', gap: 6 }}>
                  <span style={{ fontSize: 28 }}>&#128202;</span>
                  <p style={{ fontSize: 13, fontWeight: 500, color: '#636366', margin: 0 }}>No sessions yet</p>
                  <p style={{ fontSize: 11, color: '#aeaeb2', margin: 0 }}>Complete a focus session to see analytics</p>
                </div>
              ) : (
                <div className="daily-breakdown">
                  {dailyBreakdown.map((day) => (
                    <div key={day.dateKey} className="day-section">
                      <div className="day-header">
                        <span className="day-label">{day.dateLabel}</span>
                        <span className="day-total">{formatDuration(day.totalSeconds)}</span>
                      </div>
                      <div className="day-tasks">
                        {day.tasks.map((task) => (
                          <div key={task.issueKey} className="day-task-row">
                            <span className="day-task-key">{task.issueKey}</span>
                            <span className="day-task-summary">{task.summary}</span>
                            <span className="day-task-time">{formatDuration(task.totalSeconds)}</span>
                          </div>
                        ))}
                        {(day as any).breakTasks?.map((bt: any) => (
                          <div key={`break-${bt.issueKey}`} className="day-task-row">
                            <span className="day-task-key" style={{ color: '#34c759' }}>{bt.issueKey}</span>
                            <span className="day-task-summary" style={{ color: 'var(--text-muted)' }}>{bt.summary ?? 'Break'}</span>
                            <span className="day-task-time">{formatDuration(bt.totalSeconds)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
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
                          style={{ background: autoStartBreak ? 'var(--save-btn)' : 'var(--toggle-off)' }}
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
                          style={{ background: autoStartFocus ? 'var(--save-btn)' : 'var(--toggle-off)' }}
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
