import { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { storage } from "../utils/storage";
import { TimerSession } from "../types/timer";
import { useAppContext } from "../contexts/AppContext";
import { TicketDropdown } from "../components/TicketDropdown";

const FONT = `'Inter', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif`;
const RADIUS = 72;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function Timer() {
  const { timerSettings, selectedTicket } = useAppContext();

  const [timeLeft, setTimeLeft] = useState(timerSettings.focusDuration * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [timerType, setTimerType] = useState<"focus" | "break">("focus");

  const sessionStartTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const handleTimerCompleteRef = useRef<() => void>(() => {});

  // Sync timer when settings change (only when stopped)
  useEffect(() => {
    if (!isRunning) {
      setTimeLeft(
        timerType === "focus"
          ? timerSettings.focusDuration * 60
          : timerSettings.breakDuration * 60
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerSettings.focusDuration, timerSettings.breakDuration]);

  // Always-fresh completion handler
  useEffect(() => {
    handleTimerCompleteRef.current = () => {
      setIsRunning(false);

      if (sessionStartTimeRef.current !== null) {
        const session: TimerSession = {
          id: `${Date.now()}-${Math.random()}`,
          startTime: sessionStartTimeRef.current,
          endTime: Date.now(),
          duration:
            timerType === "focus"
              ? timerSettings.focusDuration * 60
              : timerSettings.breakDuration * 60,
          type: timerType,
          completed: true,
        };
        storage.addSession(session);
        sessionStartTimeRef.current = null;
      }

      const nextType = timerType === "focus" ? "break" : "focus";
      setTimerType(nextType);
      setTimeLeft(
        nextType === "focus"
          ? timerSettings.focusDuration * 60
          : timerSettings.breakDuration * 60
      );

      const shouldAutoStart =
        nextType === "focus"
          ? timerSettings.autoStartFocus
          : timerSettings.autoStartBreak;
      if (shouldAutoStart) setIsRunning(true);
    };
  });

  // Interval control
  useEffect(() => {
    if (isRunning) {
      if (sessionStartTimeRef.current === null) {
        sessionStartTimeRef.current = Date.now();
      }
      intervalRef.current = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleTimerCompleteRef.current();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  const handleReset = () => {
    setIsRunning(false);
    sessionStartTimeRef.current = null;
    setTimeLeft(
      timerType === "focus"
        ? timerSettings.focusDuration * 60
        : timerSettings.breakDuration * 60
    );
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const totalDuration =
    timerType === "focus"
      ? timerSettings.focusDuration * 60
      : timerSettings.breakDuration * 60;
  const progress = totalDuration > 0 ? (totalDuration - timeLeft) / totalDuration : 0;
  const strokeOffset = CIRCUMFERENCE * (1 - progress);

  const accentColor = timerType === "focus" ? "#007AFF" : "#34c759";

  return (
    <div
      className="flex flex-col items-center gap-5"
      style={{ fontFamily: FONT }}
    >
      {/* Session type label */}
      <AnimatePresence mode="wait">
        <motion.div
          key={timerType}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.2 }}
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: accentColor,
            background: `${accentColor}12`,
            borderRadius: 20,
            padding: "4px 12px",
          }}
        >
          {timerType === "focus" ? "Focus Session" : "Break Time"}
        </motion.div>
      </AnimatePresence>

      {/* Circular ring timer */}
      <div
        className="relative flex items-center justify-center"
        style={{ width: 180, height: 180 }}
      >
        {/* SVG ring */}
        <svg
          width="180"
          height="180"
          viewBox="0 0 180 180"
          style={{ position: "absolute", transform: "rotate(-90deg)" }}
        >
          {/* Track */}
          <circle
            cx="90"
            cy="90"
            r={RADIUS}
            fill="none"
            stroke="#e5e5ea"
            strokeWidth="3.5"
          />
          {/* Progress arc */}
          <motion.circle
            cx="90"
            cy="90"
            r={RADIUS}
            fill="none"
            stroke={accentColor}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            animate={{ strokeDashoffset: strokeOffset }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </svg>

        {/* Centered time display */}
        <div className="flex flex-col items-center gap-0.5 z-10">
          <span
            style={{
              fontSize: 38,
              fontWeight: 600,
              letterSpacing: "-0.04em",
              color: "#1c1c1e",
              fontVariantNumeric: "tabular-nums",
              fontFeatureSettings: "'tnum'",
              lineHeight: 1,
            }}
          >
            {formattedTime}
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 500,
              color: "#8e8e93",
              letterSpacing: "0.02em",
            }}
          >
            {timerType === "focus"
              ? `${timerSettings.focusDuration} min focus`
              : `${timerSettings.breakDuration} min break`}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2.5">
        {/* Reset */}
        <button
          onClick={handleReset}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "#f2f2f7",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#636366",
            transition: "background 0.15s",
            fontFamily: FONT,
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "#e5e5ea")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "#f2f2f7")
          }
          title="Reset"
        >
          <RotateCcw size={14} />
        </button>

        {/* Play / Pause */}
        <button
          onClick={() => setIsRunning((r) => !r)}
          style={{
            height: 36,
            paddingLeft: 18,
            paddingRight: 18,
            borderRadius: 10,
            background: accentColor,
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 7,
            color: "#ffffff",
            fontFamily: FONT,
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            boxShadow: `0 2px 8px ${accentColor}40`,
            transition: "opacity 0.15s, box-shadow 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          {isRunning ? <Pause size={13} fill="white" strokeWidth={0} /> : <Play size={13} fill="white" strokeWidth={0} />}
          {isRunning ? "Pause" : "Start"}
        </button>
      </div>

      {/* Active ticket indicator */}
      <AnimatePresence>
        {selectedTicket && (
          <motion.div
            initial={{ opacity: 0, y: 4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: 4, height: 0 }}
            style={{ width: "100%" }}
          >
            <div
              style={{
                background: `${accentColor}0d`,
                border: `1px solid ${accentColor}22`,
                borderRadius: 10,
                padding: "8px 12px",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: accentColor,
                  flexShrink: 0,
                  ...(isRunning && {
                    animation: "pulse 1.5s infinite",
                  }),
                }}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: accentColor,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    marginBottom: 1,
                  }}
                >
                  Tracking
                </p>
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: "#3a3a3c",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {selectedTicket.key} · {selectedTicket.summary}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ticket picker */}
      <TicketDropdown />
    </div>
  );
}
