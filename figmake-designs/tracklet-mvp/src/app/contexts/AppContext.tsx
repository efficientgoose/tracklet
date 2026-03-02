import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import { storage } from "../utils/storage";
import { TimerSettings } from "../types/timer";
import { JiraSettings, JiraTicket } from "../types/jira";
import { testJiraConnection, fetchJiraTickets } from "../utils/jira";

interface AppContextValue {
  // Timer settings
  timerSettings: TimerSettings;
  updateTimerSettings: (s: Partial<TimerSettings>) => void;

  // Jira
  jiraSettings: JiraSettings;
  jiraTickets: JiraTicket[];
  jiraLoading: boolean;
  jiraError: string | null;
  connectJira: (credentials: {
    domain: string;
    email: string;
    apiToken: string;
  }) => Promise<boolean>;
  disconnectJira: () => void;
  refreshTickets: () => Promise<void>;

  // Selected ticket
  selectedTicket: JiraTicket | null;
  setSelectedTicket: (t: JiraTicket | null) => void;

  // Settings modal
  isSettingsOpen: boolean;
  setIsSettingsOpen: (v: boolean) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [timerSettings, setTimerSettings] = useState<TimerSettings>(
    storage.getSettings
  );
  const [jiraSettings, setJiraSettings] = useState<JiraSettings>(
    storage.getJiraSettings
  );
  const [jiraTickets, setJiraTickets] = useState<JiraTicket[]>([]);
  const [jiraLoading, setJiraLoading] = useState(false);
  const [jiraError, setJiraError] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicketState] = useState<JiraTicket | null>(
    storage.getSelectedTicket
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Auto-load tickets if already connected
  useEffect(() => {
    if (jiraSettings.connected && jiraSettings.credentials) {
      fetchJiraTickets(jiraSettings.credentials)
        .then(setJiraTickets)
        .catch(() => setJiraTickets([]));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateTimerSettings = useCallback((partial: Partial<TimerSettings>) => {
    setTimerSettings((prev) => {
      const next = { ...prev, ...partial };
      storage.saveSettings(next);
      return next;
    });
  }, []);

  const connectJira = useCallback(
    async (credentials: {
      domain: string;
      email: string;
      apiToken: string;
    }): Promise<boolean> => {
      setJiraLoading(true);
      setJiraError(null);
      try {
        const result = await testJiraConnection(credentials);
        if (result.success) {
          const next: JiraSettings = {
            credentials,
            connected: true,
            lastConnected: Date.now(),
          };
          setJiraSettings(next);
          storage.saveJiraSettings(next);

          // Fetch tickets after connecting
          const tickets = await fetchJiraTickets(credentials);
          setJiraTickets(tickets);
          return true;
        } else {
          setJiraError(result.error ?? "Connection failed.");
          return false;
        }
      } catch {
        setJiraError("Unable to reach Jira. Check your credentials.");
        return false;
      } finally {
        setJiraLoading(false);
      }
    },
    []
  );

  const disconnectJira = useCallback(() => {
    const next: JiraSettings = { credentials: null, connected: false };
    setJiraSettings(next);
    storage.saveJiraSettings(next);
    setJiraTickets([]);
    setSelectedTicketState(null);
    storage.saveSelectedTicket(null);
  }, []);

  const refreshTickets = useCallback(async () => {
    if (!jiraSettings.credentials) return;
    setJiraLoading(true);
    try {
      const tickets = await fetchJiraTickets(jiraSettings.credentials);
      setJiraTickets(tickets);
    } finally {
      setJiraLoading(false);
    }
  }, [jiraSettings.credentials]);

  const setSelectedTicket = useCallback((t: JiraTicket | null) => {
    setSelectedTicketState(t);
    storage.saveSelectedTicket(t);
  }, []);

  return (
    <AppContext.Provider
      value={{
        timerSettings,
        updateTimerSettings,
        jiraSettings,
        jiraTickets,
        jiraLoading,
        jiraError,
        connectJira,
        disconnectJira,
        refreshTickets,
        selectedTicket,
        setSelectedTicket,
        isSettingsOpen,
        setIsSettingsOpen,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used inside AppProvider");
  return ctx;
}
