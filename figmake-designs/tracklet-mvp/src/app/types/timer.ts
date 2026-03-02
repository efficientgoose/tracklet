export interface TimerSession {
  id: string;
  startTime: number;
  endTime: number;
  duration: number; // in seconds
  type: "focus" | "break";
  completed: boolean;
}

export interface TimerSettings {
  focusDuration: number; // in minutes
  breakDuration: number; // in minutes
  autoStartBreak: boolean;
  autoStartFocus: boolean;
}
