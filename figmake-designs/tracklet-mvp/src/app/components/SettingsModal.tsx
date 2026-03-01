import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Clock,
  Link2,
  Link2Off,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import { useAppContext } from "../contexts/AppContext";

const FONT = `'Inter', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif`;
type Tab = "timer" | "jira";

export function SettingsModal() {
  const {
    isSettingsOpen,
    setIsSettingsOpen,
    timerSettings,
    updateTimerSettings,
    jiraSettings,
    jiraLoading,
    jiraError,
    connectJira,
    disconnectJira,
    refreshTickets,
  } = useAppContext();

  const [activeTab, setActiveTab] = useState<Tab>("timer");

  const [focusDuration, setFocusDuration] = useState(timerSettings.focusDuration);
  const [breakDuration, setBreakDuration] = useState(timerSettings.breakDuration);
  const [autoStartBreak, setAutoStartBreak] = useState(timerSettings.autoStartBreak);
  const [autoStartFocus, setAutoStartFocus] = useState(timerSettings.autoStartFocus);

  const [domain, setDomain] = useState(jiraSettings.credentials?.domain ?? "");
  const [email, setEmail] = useState(jiraSettings.credentials?.email ?? "");
  const [apiToken, setApiToken] = useState(jiraSettings.credentials?.apiToken ?? "");
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    setFocusDuration(timerSettings.focusDuration);
    setBreakDuration(timerSettings.breakDuration);
    setAutoStartBreak(timerSettings.autoStartBreak);
    setAutoStartFocus(timerSettings.autoStartFocus);
  }, [timerSettings]);

  useEffect(() => {
    setDomain(jiraSettings.credentials?.domain ?? "");
    setEmail(jiraSettings.credentials?.email ?? "");
    setApiToken(jiraSettings.credentials?.apiToken ?? "");
  }, [jiraSettings]);

  const handleSave = () => {
    updateTimerSettings({ focusDuration, breakDuration, autoStartBreak, autoStartFocus });
    setIsSettingsOpen(false);
  };

  const handleConnect = async () => {
    await connectJira({ domain, email, apiToken });
  };

  const handleDisconnect = () => {
    disconnectJira();
    setDomain("");
    setEmail("");
    setApiToken("");
  };

  return (
    <AnimatePresence>
      {isSettingsOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.30)", backdropFilter: "blur(3px)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsSettingsOpen(false)}
          />

          {/* Sheet */}
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-5"
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: "spring", stiffness: 450, damping: 34 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                maxWidth: 340,
                background: "#ffffff",
                borderRadius: 18,
                boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
                border: "1px solid rgba(0,0,0,0.08)",
                overflow: "hidden",
                fontFamily: FONT,
              }}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between"
                style={{
                  padding: "14px 16px 12px",
                  borderBottom: "1px solid rgba(0,0,0,0.07)",
                }}
              >
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: "#1c1c1e",
                    letterSpacing: "-0.02em",
                  }}
                >
                  Settings
                </span>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    background: "#e5e5ea",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#636366",
                  }}
                >
                  <X size={12} strokeWidth={2.5} />
                </button>
              </div>

              {/* Tab bar */}
              <div className="flex" style={{ borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
                {(["timer", "jira"] as Tab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      flex: 1,
                      height: 40,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      fontSize: 12,
                      fontWeight: 500,
                      fontFamily: FONT,
                      color: activeTab === tab ? "#007AFF" : "#8e8e93",
                      background: "transparent",
                      border: "none",
                      borderBottom: `2px solid ${activeTab === tab ? "#007AFF" : "transparent"}`,
                      cursor: "pointer",
                      transition: "color 0.15s, border-color 0.15s",
                      marginBottom: -1,
                    }}
                  >
                    {tab === "timer" ? <Clock size={12} /> : <Link2 size={12} />}
                    {tab === "timer" ? "Timer" : "Jira"}
                  </button>
                ))}
              </div>

              {/* Body */}
              <div style={{ padding: "16px" }}>
                {activeTab === "timer" && (
                  <div className="flex flex-col gap-4">
                    {/* Durations */}
                    <div>
                      <SectionLabel>Duration</SectionLabel>
                      <div className="grid grid-cols-2 gap-2">
                        <NumberStepper
                          label="Focus"
                          value={focusDuration}
                          onChange={setFocusDuration}
                          min={1}
                          max={120}
                          unit="min"
                        />
                        <NumberStepper
                          label="Break"
                          value={breakDuration}
                          onChange={setBreakDuration}
                          min={1}
                          max={60}
                          unit="min"
                        />
                      </div>
                    </div>

                    {/* Auto-start */}
                    <div>
                      <SectionLabel>Auto-start</SectionLabel>
                      <div
                        style={{
                          background: "#f9f9fb",
                          borderRadius: 12,
                          border: "1px solid rgba(0,0,0,0.06)",
                          overflow: "hidden",
                        }}
                      >
                        <ToggleRow
                          label="Break timer"
                          checked={autoStartBreak}
                          onChange={setAutoStartBreak}
                          divider
                        />
                        <ToggleRow
                          label="Focus timer"
                          checked={autoStartFocus}
                          onChange={setAutoStartFocus}
                        />
                      </div>
                    </div>

                    <AppleButton onClick={handleSave} variant="primary">
                      Save
                    </AppleButton>
                  </div>
                )}

                {activeTab === "jira" && (
                  <div className="flex flex-col gap-3">
                    {jiraSettings.connected ? (
                      <>
                        {/* Connected state */}
                        <div
                          className="flex items-center gap-3"
                          style={{
                            background: "rgba(52,199,89,0.08)",
                            border: "1px solid rgba(52,199,89,0.20)",
                            borderRadius: 12,
                            padding: "10px 12px",
                          }}
                        >
                          <CheckCircle2 size={16} color="#34c759" />
                          <div>
                            <p style={{ fontSize: 12, fontWeight: 600, color: "#1c1c1e" }}>
                              Connected
                            </p>
                            <p style={{ fontSize: 11, color: "#636366" }}>
                              {jiraSettings.credentials?.domain}
                            </p>
                          </div>
                        </div>

                        <AppleButton
                          onClick={refreshTickets}
                          variant="secondary"
                          loading={jiraLoading}
                          icon={<RefreshCw size={12} />}
                        >
                          Refresh Tickets
                        </AppleButton>

                        <AppleButton
                          onClick={handleDisconnect}
                          variant="destructive"
                          icon={<Link2Off size={12} />}
                        >
                          Disconnect
                        </AppleButton>
                      </>
                    ) : (
                      <>
                        {jiraError && (
                          <div
                            className="flex items-center gap-2"
                            style={{
                              background: "rgba(255,59,48,0.08)",
                              border: "1px solid rgba(255,59,48,0.18)",
                              borderRadius: 10,
                              padding: "9px 12px",
                            }}
                          >
                            <AlertCircle size={13} color="#ff3b30" />
                            <span style={{ fontSize: 11, color: "#ff3b30" }}>{jiraError}</span>
                          </div>
                        )}

                        <div className="flex flex-col gap-2.5">
                          <TextField
                            label="Domain"
                            placeholder="company.atlassian.net"
                            value={domain}
                            onChange={setDomain}
                          />
                          <TextField
                            label="Email"
                            placeholder="you@company.com"
                            value={email}
                            onChange={setEmail}
                            type="email"
                          />
                          <div className="flex flex-col gap-1">
                            <FieldLabel>API Token</FieldLabel>
                            <div className="relative">
                              <input
                                type={showToken ? "text" : "password"}
                                placeholder="••••••••••••"
                                value={apiToken}
                                onChange={(e) => setApiToken(e.target.value)}
                                style={inputStyle}
                              />
                              <button
                                type="button"
                                onClick={() => setShowToken(!showToken)}
                                style={{
                                  position: "absolute",
                                  right: 10,
                                  top: "50%",
                                  transform: "translateY(-50%)",
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  color: "#8e8e93",
                                  display: "flex",
                                  padding: 0,
                                }}
                              >
                                {showToken ? <EyeOff size={12} /> : <Eye size={12} />}
                              </button>
                            </div>
                          </div>
                        </div>

                        <AppleButton
                          onClick={handleConnect}
                          variant="primary"
                          loading={jiraLoading}
                          disabled={!domain.trim() || !email.trim() || !apiToken.trim()}
                          icon={<Link2 size={12} />}
                        >
                          Connect Jira
                        </AppleButton>

                        <p
                          style={{
                            fontSize: 10,
                            color: "#aeaeb2",
                            textAlign: "center",
                            lineHeight: 1.5,
                          }}
                        >
                          Your token is stored locally and never sent to our servers.
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ─── Reusable sub-components ──────────────────────────────────── */

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 34,
  background: "#f9f9fb",
  border: "1px solid rgba(0,0,0,0.10)",
  borderRadius: 9,
  padding: "0 10px",
  fontSize: 13,
  color: "#1c1c1e",
  fontFamily: `'Inter', -apple-system, BlinkMacSystemFont, sans-serif`,
  outline: "none",
  boxSizing: "border-box",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: "#8e8e93",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        marginBottom: 8,
        fontFamily: FONT,
      }}
    >
      {children}
    </p>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 500,
        color: "#636366",
        fontFamily: FONT,
      }}
    >
      {children}
    </span>
  );
}

function TextField({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <FieldLabel>{label}</FieldLabel>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
    </div>
  );
}

function NumberStepper({
  label,
  value,
  onChange,
  min,
  max,
  unit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  unit: string;
}) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));

  return (
    <div
      style={{
        background: "#f9f9fb",
        border: "1px solid rgba(0,0,0,0.07)",
        borderRadius: 10,
        padding: "10px 12px",
        fontFamily: FONT,
      }}
    >
      <p style={{ fontSize: 10, fontWeight: 600, color: "#8e8e93", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
        {label}
      </p>
      <div className="flex items-center justify-between">
        <button
          onClick={dec}
          style={{
            width: 26, height: 26, borderRadius: 8,
            background: "#e5e5ea", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, color: "#1c1c1e", fontWeight: 300,
          }}
        >−</button>
        <div className="flex items-baseline gap-1">
          <span style={{ fontSize: 20, fontWeight: 600, color: "#1c1c1e", fontVariantNumeric: "tabular-nums", fontFeatureSettings: "'tnum'" }}>
            {value}
          </span>
          <span style={{ fontSize: 10, color: "#8e8e93" }}>{unit}</span>
        </div>
        <button
          onClick={inc}
          style={{
            width: 26, height: 26, borderRadius: 8,
            background: "#e5e5ea", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, color: "#1c1c1e", fontWeight: 300,
          }}
        >+</button>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  divider,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  divider?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between"
      style={{
        padding: "10px 12px",
        borderBottom: divider ? "1px solid rgba(0,0,0,0.06)" : "none",
        cursor: "pointer",
      }}
      onClick={() => onChange(!checked)}
    >
      <span style={{ fontSize: 13, fontWeight: 400, color: "#1c1c1e", fontFamily: FONT }}>
        {label}
      </span>
      {/* iOS-style toggle */}
      <div
        style={{
          width: 36,
          height: 20,
          borderRadius: 10,
          background: checked ? "#34c759" : "#e5e5ea",
          position: "relative",
          transition: "background 0.2s",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        <motion.div
          animate={{ x: checked ? 17 : 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            background: "#ffffff",
            position: "absolute",
            top: 1,
            boxShadow: "0 1px 3px rgba(0,0,0,0.20)",
          }}
        />
      </div>
    </div>
  );
}

function AppleButton({
  children,
  onClick,
  variant = "primary",
  loading = false,
  disabled = false,
  icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "primary" | "secondary" | "destructive";
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  const bg =
    variant === "primary"
      ? "#007AFF"
      : variant === "destructive"
      ? "#ff3b30"
      : "#f2f2f7";
  const color = variant === "secondary" ? "#1c1c1e" : "#ffffff";

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        width: "100%",
        height: 38,
        borderRadius: 10,
        background: bg,
        border: "none",
        cursor: disabled || loading ? "not-allowed" : "pointer",
        opacity: disabled || loading ? 0.5 : 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        fontSize: 13,
        fontWeight: 500,
        color,
        fontFamily: FONT,
        transition: "opacity 0.15s",
      }}
    >
      {loading ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : icon}
      {children}
    </button>
  );
}
