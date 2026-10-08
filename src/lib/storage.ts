export type DesignSubmission = {
  applicationName: string;
  applicationDescription: string;
  nodes: unknown[];
  edges: unknown[];
  notes: string;
  status: "draft" | "submitted";
  updatedAt: string;
};

const DESIGN_KEY = "breachx-design";
const ACTIVITY_KEY = "breachx-activity";

export function readSubmission(): DesignSubmission | null {
  const raw = localStorage.getItem(DESIGN_KEY);
  return raw ? (JSON.parse(raw) as DesignSubmission) : null;
}

export function writeSubmission(value: DesignSubmission) {
  localStorage.setItem(DESIGN_KEY, JSON.stringify(value));
  window.dispatchEvent(new Event("breachx-sync"));
}

export function logActivity(
  action: string,
  metadata: Record<string, unknown> = {},
) {
  const existing = JSON.parse(
    localStorage.getItem(ACTIVITY_KEY) ?? "[]",
  ) as {
    action: string;
    metadata: Record<string, unknown>;
    createdAt: string;
  }[];

  existing.unshift({
    action,
    metadata,
    createdAt: new Date().toISOString(),
  });

  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(existing.slice(0, 100)));
  window.dispatchEvent(new Event("breachx-sync"));
}

export function readLogs() {
  return JSON.parse(localStorage.getItem(ACTIVITY_KEY) ?? "[]") as {
    action: string;
    metadata: Record<string, unknown>;
    createdAt: string;
  }[];
}
