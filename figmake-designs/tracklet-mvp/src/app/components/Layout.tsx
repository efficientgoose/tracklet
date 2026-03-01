import { Link, useLocation } from "react-router";
import { Settings } from "lucide-react";
import { motion } from "motion/react";
import { useAppContext } from "../contexts/AppContext";
import { SettingsModal } from "./SettingsModal";

interface LayoutProps {
  children: React.ReactNode;
}

const FONT = `'Inter', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif`;

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const isAnalytics = location.pathname === "/analytics";
  const { jiraSettings, setIsSettingsOpen } = useAppContext();

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{
        background: "#f2f2f7",
        fontFamily: FONT,
      }}
    >
      <SettingsModal />

      {/* Widget */}
      <div
        className="w-full"
        style={{
          maxWidth: 340,
          background: "#ffffff",
          borderRadius: 20,
          boxShadow:
            "0 2px 8px rgba(0,0,0,0.06), 0 12px 40px rgba(0,0,0,0.10)",
          border: "1px solid rgba(0,0,0,0.07)",
          overflow: "hidden",
        }}
      >
        {/* ── Header ─────────────────────────────── */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid rgba(0,0,0,0.07)",
          }}
        >
          {/* Left — title */}
          <div className="flex items-center gap-2.5">
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: "#007AFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 1px 4px rgba(0,122,255,0.35)",
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
              >
                <circle
                  cx="7"
                  cy="7"
                  r="5.5"
                  stroke="white"
                  strokeWidth="1.5"
                />
                <path
                  d="M7 4.5V7.5L9 9"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "#1c1c1e",
                letterSpacing: "-0.02em",
              }}
            >
              Tracklet
            </span>
          </div>

          {/* Right — Jira chip + settings */}
          <div className="flex items-center gap-2">
            {jiraSettings.connected ? (
              <div
                className="flex items-center gap-1"
                style={{
                  background: "rgba(52,199,89,0.10)",
                  borderRadius: 20,
                  padding: "3px 8px",
                }}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#34c759",
                  }}
                />
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: "#34c759",
                    letterSpacing: "0.01em",
                  }}
                >
                  Jira
                </span>
              </div>
            ) : (
              <button
                onClick={() => setIsSettingsOpen(true)}
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  color: "#8e8e93",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  letterSpacing: "0.01em",
                }}
              >
                Connect Jira
              </button>
            )}

            <button
              onClick={() => setIsSettingsOpen(true)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#8e8e93",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#f2f2f7")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
              title="Settings"
            >
              <Settings size={14} />
            </button>
          </div>
        </div>

        {/* ── Segmented Tab Control ───────────────── */}
        <div style={{ padding: "10px 16px 0" }}>
          <div
            className="relative flex"
            style={{
              background: "#e9e9eb",
              borderRadius: 9,
              padding: 3,
              height: 30,
            }}
          >
            {/* Sliding pill */}
            <motion.div
              className="absolute"
              style={{
                top: 3,
                bottom: 3,
                background: "#ffffff",
                borderRadius: 7,
                boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 1px 1px rgba(0,0,0,0.06)",
              }}
              initial={false}
              animate={{
                left: isAnalytics ? "calc(50%)" : "3px",
                width: "calc(50% - 3px)",
              }}
              transition={{ type: "spring", stiffness: 400, damping: 36 }}
            />

            <Link
              to="/"
              className="flex-1 relative z-10 flex items-center justify-center"
              style={{ textDecoration: "none" }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: !isAnalytics ? "#1c1c1e" : "#8e8e93",
                  letterSpacing: "-0.01em",
                  transition: "color 0.2s",
                  fontFamily: FONT,
                }}
              >
                Timer
              </span>
            </Link>

            <Link
              to="/analytics"
              className="flex-1 relative z-10 flex items-center justify-center"
              style={{ textDecoration: "none" }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: isAnalytics ? "#1c1c1e" : "#8e8e93",
                  letterSpacing: "-0.01em",
                  transition: "color 0.2s",
                  fontFamily: FONT,
                }}
              >
                Analytics
              </span>
            </Link>
          </div>
        </div>

        {/* ── Content ────────────────────────────── */}
        <div style={{ padding: "16px 16px 20px", minHeight: 360 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
