export interface JiraCredentials {
  domain: string;   // e.g. "yourcompany.atlassian.net"
  email: string;
  apiToken: string;
}

export interface JiraTicket {
  id: string;
  key: string;
  summary: string;
  type: "Story" | "Bug" | "Task" | "Epic" | "Sub-task";
  status: "To Do" | "In Progress" | "In Review" | "Done";
  priority: "Highest" | "High" | "Medium" | "Low" | "Lowest";
}

export interface JiraSettings {
  credentials: JiraCredentials | null;
  connected: boolean;
  lastConnected?: number;
}
