import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Trash2 } from "lucide-react";
import { storage } from "../utils/storage";
import { TimerSession } from "../types/timer";
import { format, startOfDay, subDays, isWithinInterval } from "date-fns";

const FONT = `'Inter', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif`;

export default function Analytics() {
  const [sessions, setSessions] = useState<TimerSession[]>([]);
  const [timeRange, setTimeRange] = useState<"7d" | "30d">("7d");

  useEffect(() => {
    setSessions(storage.getSessions());
  }, []);

  const filteredSessions = sessions.filter((s) => {
    const days = timeRange === "7d" ? 7 : 30;
    return isWithinInterval(s.startTime, {
      start: startOfDay(subDays(new Date(), days)),
      end: new Date(),
    });
  });

  const focusSessions = filteredSessions.filter((s) => s.type === "focus");
  const totalFocusTime = focusSessions.reduce((a, s) => a + s.duration, 0);
  const totalSessions = filteredSessions.length;

  // Daily chart data (last 7 days)
  const dailyData: Record<string, { focus: number; break: number }> = {};
  for (let i = 6; i >= 0; i--) {
    dailyData[format(subDays(new Date(), i), "EEE")] = { focus: 0, break: 0 };
  }
  filteredSessions.forEach((s) => {
    const key = format(s.startTime, "EEE");
    if (dailyData[key]) dailyData[key][s.type] += s.duration / 60;
  });
  const chartData = Object.entries(dailyData).map(([date, d]) => ({
    date,
    Focus: Math.round(d.focus),
    Break: Math.round(d.break),
  }));

  const breakSessions = filteredSessions.filter((s) => s.type === "break");
  const totalBreakTime = breakSessions.reduce((a, s) => a + s.duration, 0);
  const pieData = [
    { name: "Focus", value: Math.round(totalFocusTime / 60), color: "#007AFF" },
    { name: "Break", value: Math.round(totalBreakTime / 60), color: "#34c759" },
  ];

  const fmt = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.round((secs % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const handleClear = () => {
    if (window.confirm("Delete all session data? This cannot be undone.")) {
      storage.clearSessions();
      setSessions([]);
    }
  };

  return (
    <div
      style={{
        fontFamily: FONT,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        maxHeight: 440,
        overflowY: "auto",
        paddingBottom: 4,
      }}
    >
      {/* Controls */}
      <div
        className="flex items-center justify-between"
        style={{ position: "sticky", top: 0, background: "#ffffff", paddingBottom: 4, zIndex: 5 }}
      >
        {/* Range picker */}
        <div
          style={{
            display: "flex",
            background: "#e9e9eb",
            borderRadius: 8,
            padding: 3,
          }}
        >
          {(["7d", "30d"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              style={{
                height: 22,
                padding: "0 10px",
                borderRadius: 6,
                background: timeRange === r ? "#ffffff" : "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 500,
                color: timeRange === r ? "#1c1c1e" : "#8e8e93",
                fontFamily: FONT,
                boxShadow: timeRange === r ? "0 1px 3px rgba(0,0,0,0.10)" : "none",
                transition: "all 0.15s",
              }}
            >
              {r === "7d" ? "7 Days" : "30 Days"}
            </button>
          ))}
        </div>

        <button
          onClick={handleClear}
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "#ff3b30",
          }}
          title="Clear data"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <StatCard label="Focus Time" value={fmt(totalFocusTime)} color="#007AFF" />
        <StatCard label="Sessions" value={String(totalSessions)} color="#007AFF" />
      </div>

      {/* Bar chart */}
      <div
        style={{
          background: "#f9f9fb",
          border: "1px solid rgba(0,0,0,0.07)",
          borderRadius: 14,
          padding: "14px 12px 10px",
        }}
      >
        <p
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#636366",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: 12,
            fontFamily: FONT,
          }}
        >
          Activity (min)
        </p>
        <div style={{ height: 130 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={2}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9, fill: "#aeaeb2", fontFamily: FONT }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "#ffffff",
                  border: "1px solid rgba(0,0,0,0.09)",
                  borderRadius: 10,
                  fontSize: 11,
                  fontFamily: FONT,
                  boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
                }}
                cursor={{ fill: "rgba(0,0,0,0.03)" }}
              />
              <Bar dataKey="Focus" fill="#007AFF" radius={[4, 4, 0, 0]} barSize={14} />
              <Bar dataKey="Break" fill="#34c759" radius={[4, 4, 0, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Distribution */}
      <div
        style={{
          background: "#f9f9fb",
          border: "1px solid rgba(0,0,0,0.07)",
          borderRadius: 14,
          padding: "14px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#636366",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 10,
              fontFamily: FONT,
            }}
          >
            Distribution
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {pieData.map((e) => (
              <div
                key={e.name}
                style={{ display: "flex", alignItems: "center", gap: 7 }}
              >
                <div
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: e.color,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 11, color: "#636366", fontFamily: FONT }}>
                  {e.name}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#1c1c1e",
                    fontFamily: FONT,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {e.value}m
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
                {pieData.map((e, i) => (
                  <Cell key={i} fill={e.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Empty state */}
      {totalSessions === 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px 0",
            gap: 6,
          }}
        >
          <span style={{ fontSize: 28 }}>📊</span>
          <p style={{ fontSize: 13, fontWeight: 500, color: "#636366", fontFamily: FONT }}>
            No sessions yet
          </p>
          <p style={{ fontSize: 11, color: "#aeaeb2", fontFamily: FONT }}>
            Complete a focus session to see analytics
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      style={{
        background: "#f9f9fb",
        border: "1px solid rgba(0,0,0,0.07)",
        borderRadius: 14,
        padding: "12px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <p
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: "#8e8e93",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          fontFamily: FONT,
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: 22,
          fontWeight: 700,
          color,
          fontFamily: FONT,
          fontVariantNumeric: "tabular-nums",
          fontFeatureSettings: "'tnum'",
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
      >
        {value}
      </p>
    </div>
  );
}
