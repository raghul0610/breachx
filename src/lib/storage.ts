export type EventStatus = "DRAFT" | "READY" | "LIVE" | "PAUSED" | "ENDED";
export type Submission = {
  teamId: string;
  teamName: string;
  problem: string;
  nodes: unknown[];
  edges: unknown[];
  notes: string;
  status: "draft" | "submitted";
  updatedAt: string;
};
const EVENT_KEY = "breachx-event";
const TEAMS_KEY = "breachx-teams";
const SUB_KEY = "breachx-submission";
const LOG_KEY = "breachx-logs";
export function readStatus(): EventStatus {
  return (localStorage.getItem(EVENT_KEY) as EventStatus | null) ?? "DRAFT";
}
export function writeStatus(status: EventStatus) {
  localStorage.setItem(EVENT_KEY, status);
  window.dispatchEvent(new Event("breachx-sync"));
}
export function readTeams() {
  const raw = localStorage.getItem(TEAMS_KEY);
  if (raw) return JSON.parse(raw) as { id:string; name:string; stage:string; status:string }[];
  const seed = [
    { id:"team-1", name:"Team Alpha", stage:"BLUEPRINT", status:"IN PROGRESS" },
    { id:"team-2", name:"Team Beta", stage:"BLUEPRINT", status:"IN PROGRESS" },
    { id:"team-3", name:"Team Gamma", stage:"WAITING", status:"NOT STARTED" }
  ];
  localStorage.setItem(TEAMS_KEY, JSON.stringify(seed));
  return seed;
}
export function readSubmission(): Submission | null {
  const raw = localStorage.getItem(SUB_KEY);
  return raw ? JSON.parse(raw) as Submission : null;
}
export function writeSubmission(value: Submission) {
  localStorage.setItem(SUB_KEY, JSON.stringify(value));
  window.dispatchEvent(new Event("breachx-sync"));
}
export function logActivity(action:string, metadata:Record<string,unknown>={}) {
  const existing = JSON.parse(localStorage.getItem(LOG_KEY) ?? "[]") as {action:string;metadata:Record<string,unknown>;createdAt:string}[];
  existing.unshift({action, metadata, createdAt:new Date().toISOString()});
  localStorage.setItem(LOG_KEY, JSON.stringify(existing.slice(0,100)));
  window.dispatchEvent(new Event("breachx-sync"));
}
export function readLogs() {
  return JSON.parse(localStorage.getItem(LOG_KEY) ?? "[]") as {action:string;metadata:Record<string,unknown>;createdAt:string}[];
}