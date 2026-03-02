import { TimerSession, TimerSettings } from "../types/timer";
import { JiraSettings, JiraTicket } from "../types/jira";

const SESSIONS_KEY = "timer_sessions";
const SETTINGS_KEY = "timer_settings";
const JIRA_KEY = "jira_settings";
const SELECTED_TICKET_KEY = "selected_ticket";

export const storage = {
  getSessions: (): TimerSession[] => {
    try {
      const data = localStorage.getItem(SESSIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("Error reading sessions:", error);
      return [];
    }
  },

  saveSessions: (sessions: TimerSession[]): void => {
    try {
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    } catch (error) {
      console.error("Error saving sessions:", error);
    }
  },

  addSession: (session: TimerSession): void => {
    const sessions = storage.getSessions();
    sessions.push(session);
    storage.saveSessions(sessions);
  },

  getSettings: (): TimerSettings => {
    try {
      const data = localStorage.getItem(SETTINGS_KEY);
      return data
        ? JSON.parse(data)
        : {
            focusDuration: 25,
            breakDuration: 5,
            autoStartBreak: false,
            autoStartFocus: false,
          };
    } catch (error) {
      console.error("Error reading settings:", error);
      return {
        focusDuration: 25,
        breakDuration: 5,
        autoStartBreak: false,
        autoStartFocus: false,
      };
    }
  },

  saveSettings: (settings: TimerSettings): void => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  },

  clearSessions: (): void => {
    localStorage.removeItem(SESSIONS_KEY);
  },

  getJiraSettings: (): JiraSettings => {
    try {
      const data = localStorage.getItem(JIRA_KEY);
      return data
        ? JSON.parse(data)
        : { credentials: null, connected: false };
    } catch {
      return { credentials: null, connected: false };
    }
  },

  saveJiraSettings: (settings: JiraSettings): void => {
    try {
      localStorage.setItem(JIRA_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error("Error saving Jira settings:", error);
    }
  },

  getSelectedTicket: (): JiraTicket | null => {
    try {
      const data = localStorage.getItem(SELECTED_TICKET_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  saveSelectedTicket: (ticket: JiraTicket | null): void => {
    try {
      if (ticket) {
        localStorage.setItem(SELECTED_TICKET_KEY, JSON.stringify(ticket));
      } else {
        localStorage.removeItem(SELECTED_TICKET_KEY);
      }
    } catch (error) {
      console.error("Error saving selected ticket:", error);
    }
  },
};