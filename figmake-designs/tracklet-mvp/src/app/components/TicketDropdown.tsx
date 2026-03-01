import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, Search, X, Loader2 } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import { JiraTicket } from "../types/jira";
import { TYPE_COLORS, PRIORITY_COLORS } from "../utils/jira";

const FONT = `'Inter', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif`;

export function TicketDropdown() {
  const {
    jiraSettings,
    jiraTickets,
    jiraLoading,
    selectedTicket,
    setSelectedTicket,
    setIsSettingsOpen,
  } = useAppContext();

  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (isOpen) setTimeout(() => searchRef.current?.focus(), 60);
  }, [isOpen]);

  const filtered = jiraTickets.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return t.key.toLowerCase().includes(q) || t.summary.toLowerCase().includes(q);
  });

  const handleSelect = (ticket: JiraTicket) => {
    setSelectedTicket(ticket);
    setIsOpen(false);
    setSearch("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTicket(null);
  };

  // Trigger button styles
  const triggerStyle: React.CSSProperties = {
    width: "100%",
    height: 36,
    background: isOpen ? "#f0f7ff" : "#f9f9fb",
    border: `1px solid ${isOpen ? "rgba(0,122,255,0.25)" : "rgba(0,0,0,0.09)"}`,
    borderRadius: 10,
    padding: "0 10px 0 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    cursor: "pointer",
    fontFamily: FONT,
    transition: "background 0.15s, border-color 0.15s",
  };

  if (!jiraSettings.connected) {
    return (
      <div style={{ width: "100%" }}>
        <button
          onClick={() => setIsSettingsOpen(true)}
          style={{
            ...triggerStyle,
            background: "#f9f9fb",
            border: "1px dashed rgba(0,0,0,0.15)",
          }}
        >
          <span style={{ fontSize: 12, color: "#aeaeb2", fontFamily: FONT }}>
            Connect Jira to track tickets
          </span>
          <ChevronDown size={13} color="#aeaeb2" />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ width: "100%", position: "relative" }}>
      {/* Trigger */}
      <button onClick={() => setIsOpen(!isOpen)} style={triggerStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            minWidth: 0,
            flex: 1,
            overflow: "hidden",
          }}
        >
          {jiraLoading ? (
            <Loader2 size={12} color="#007AFF" style={{ flexShrink: 0, animation: "spin 1s linear infinite" }} />
          ) : selectedTicket ? (
            <>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: TYPE_COLORS[selectedTicket.type] ?? "#007AFF",
                  background: `${TYPE_COLORS[selectedTicket.type] ?? "#007AFF"}14`,
                  padding: "2px 6px",
                  borderRadius: 4,
                  flexShrink: 0,
                  fontFamily: FONT,
                }}
              >
                {selectedTicket.key}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 400,
                  color: "#3a3a3c",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontFamily: FONT,
                }}
              >
                {selectedTicket.summary}
              </span>
            </>
          ) : (
            <span style={{ fontSize: 12, color: "#aeaeb2", fontFamily: FONT }}>
              Select a ticket to track…
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0, marginLeft: 6 }}>
          {selectedTicket && !jiraLoading && (
            <span
              onClick={handleClear}
              style={{
                width: 16,
                height: 16,
                borderRadius: 8,
                background: "#e5e5ea",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <X size={9} color="#636366" />
            </span>
          )}
          <ChevronDown
            size={13}
            color="#8e8e93"
            style={{
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
            }}
          />
        </div>
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              right: 0,
              background: "#ffffff",
              border: "1px solid rgba(0,0,0,0.09)",
              borderRadius: 12,
              boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
              zIndex: 30,
              overflow: "hidden",
              fontFamily: FONT,
            }}
          >
            {/* Search bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                borderBottom: "1px solid rgba(0,0,0,0.06)",
              }}
            >
              <Search size={12} color="#aeaeb2" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search tickets…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  flex: 1,
                  fontSize: 12,
                  fontFamily: FONT,
                  background: "none",
                  border: "none",
                  outline: "none",
                  color: "#1c1c1e",
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 0 }}
                >
                  <X size={11} color="#aeaeb2" />
                </button>
              )}
            </div>

            {/* List */}
            <div style={{ maxHeight: 220, overflowY: "auto" }}>
              {filtered.length === 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "24px 0",
                    gap: 6,
                  }}
                >
                  <Search size={18} color="#d1d1d6" />
                  <span style={{ fontSize: 12, color: "#aeaeb2", fontFamily: FONT }}>
                    No tickets found
                  </span>
                </div>
              ) : (
                filtered.map((ticket, i) => (
                  <TicketRow
                    key={ticket.id}
                    ticket={ticket}
                    selected={selectedTicket?.id === ticket.id}
                    onSelect={handleSelect}
                    divider={i < filtered.length - 1}
                  />
                ))
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                borderTop: "1px solid rgba(0,0,0,0.06)",
                padding: "6px 12px",
                background: "#f9f9fb",
              }}
            >
              <span style={{ fontSize: 10, color: "#aeaeb2", fontFamily: FONT }}>
                {filtered.length} ticket{filtered.length !== 1 ? "s" : ""} ·{" "}
                {jiraSettings.credentials?.domain}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TicketRow({
  ticket,
  selected,
  onSelect,
  divider,
}: {
  ticket: JiraTicket;
  selected: boolean;
  onSelect: (t: JiraTicket) => void;
  divider: boolean;
}) {
  const [hover, setHover] = useState(false);
  const typeColor = TYPE_COLORS[ticket.type] ?? "#007AFF";
  const priorityColor = PRIORITY_COLORS[ticket.priority] ?? "#8e8e93";

  return (
    <button
      onClick={() => onSelect(ticket)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "9px 12px",
        background: selected ? "#f0f7ff" : hover ? "#f9f9fb" : "transparent",
        border: "none",
        borderBottom: divider ? "1px solid rgba(0,0,0,0.05)" : "none",
        cursor: "pointer",
        textAlign: "left",
        fontFamily: `'Inter', -apple-system, BlinkMacSystemFont, sans-serif`,
        transition: "background 0.1s",
      }}
    >
      {/* Type badge */}
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: typeColor,
          background: `${typeColor}14`,
          padding: "2px 5px",
          borderRadius: 4,
          flexShrink: 0,
          marginTop: 1,
          letterSpacing: "0.02em",
        }}
      >
        {ticket.key}
      </span>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 12,
            fontWeight: 400,
            color: "#1c1c1e",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            marginBottom: 2,
          }}
        >
          {ticket.summary}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, color: "#8e8e93" }}>{ticket.status}</span>
          <span style={{ fontSize: 10, color: priorityColor, fontWeight: 500 }}>
            {ticket.priority}
          </span>
        </div>
      </div>

      {/* Check */}
      {selected && (
        <span style={{ fontSize: 14, color: "#007AFF", flexShrink: 0, marginTop: 1 }}>✓</span>
      )}
    </button>
  );
}
