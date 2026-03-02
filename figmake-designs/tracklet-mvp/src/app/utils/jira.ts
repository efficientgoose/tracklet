import { JiraTicket, JiraCredentials } from "../types/jira";

// Mock tickets to simulate a Jira project board
const MOCK_TICKETS: JiraTicket[] = [
  {
    id: "1",
    key: "PROJ-101",
    summary: "Implement user authentication flow",
    type: "Story",
    status: "In Progress",
    priority: "High",
  },
  {
    id: "2",
    key: "PROJ-102",
    summary: "Fix navigation bug on mobile",
    type: "Bug",
    status: "To Do",
    priority: "Medium",
  },
  {
    id: "3",
    key: "PROJ-103",
    summary: "Update dashboard analytics charts",
    type: "Task",
    status: "In Progress",
    priority: "Medium",
  },
  {
    id: "4",
    key: "PROJ-104",
    summary: "Code review: payment integration module",
    type: "Task",
    status: "In Review",
    priority: "High",
  },
  {
    id: "5",
    key: "PROJ-105",
    summary: "Write unit tests for the API layer",
    type: "Story",
    status: "To Do",
    priority: "Low",
  },
  {
    id: "6",
    key: "BUG-201",
    summary: "Fix memory leak in timer component",
    type: "Bug",
    status: "In Progress",
    priority: "Highest",
  },
  {
    id: "7",
    key: "BUG-202",
    summary: "Resolve CSS overflow issue on Safari",
    type: "Bug",
    status: "To Do",
    priority: "Medium",
  },
  {
    id: "8",
    key: "PROJ-106",
    summary: "Migrate database schema to v2",
    type: "Task",
    status: "To Do",
    priority: "High",
  },
];

/**
 * Simulate fetching assigned/active tickets from Jira.
 * Replace this with real Jira REST API calls once you have a CORS proxy or backend.
 */
export async function fetchJiraTickets(
  _credentials: JiraCredentials
): Promise<JiraTicket[]> {
  // Simulate network latency
  await new Promise((resolve) => setTimeout(resolve, 800));
  return MOCK_TICKETS;
}

/**
 * Simulate testing Jira credentials.
 * A real implementation would call: GET https://{domain}/rest/api/3/myself
 */
export async function testJiraConnection(
  _credentials: JiraCredentials
): Promise<{ success: boolean; displayName?: string; error?: string }> {
  await new Promise((resolve) => setTimeout(resolve, 1200));
  // Simulate success if all fields are non-empty
  if (
    _credentials.domain.trim() &&
    _credentials.email.trim() &&
    _credentials.apiToken.trim()
  ) {
    return { success: true, displayName: _credentials.email.split("@")[0] };
  }
  return { success: false, error: "Invalid credentials." };
}

export const TYPE_COLORS: Record<string, string> = {
  Story: "#36b37e",
  Bug: "#ff5630",
  Task: "#0052cc",
  Epic: "#6554c0",
  "Sub-task": "#0065ff",
};

export const PRIORITY_COLORS: Record<string, string> = {
  Highest: "#ff5630",
  High: "#ff7452",
  Medium: "#ffab00",
  Low: "#36b37e",
  Lowest: "#6554c0",
};
