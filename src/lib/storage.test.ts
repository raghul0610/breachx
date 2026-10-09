import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createProject,
  deleteProject,
  duplicateProject,
  listProjects,
  readSubmission,
  renameProject,
  setActiveProject,
  writeSubmission,
} from "./storage";

const memory = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => { memory.set(key, String(value)); },
  removeItem: (key: string) => { memory.delete(key); },
  clear: () => memory.clear(),
  key: (index: number) => [...memory.keys()][index] ?? null,
  get length() { return memory.size; },
};

beforeEach(() => {
  memory.clear();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: localStorageMock });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { dispatchEvent: () => true },
  });
});

afterEach(() => memory.clear());

const submission = (name: string) => ({
  applicationName: name,
  applicationDescription: "A test system",
  nodes: [{ id: "node-1", data: { label: name } }],
  edges: [],
  notes: "test notes",
  status: "draft" as const,
  updatedAt: new Date().toISOString(),
});

describe("project persistence", () => {
  it("migrates the legacy single design once and keeps it available", () => {
    memory.set("breachx-design", JSON.stringify(submission("Legacy design")));

    const projects = listProjects();

    expect(projects).toHaveLength(1);
    expect(projects[0].applicationName).toBe("Legacy design");
    expect(memory.has("breachx-design")).toBe(true);
    expect(listProjects()).toHaveLength(1);
  });

  it("isolates data between projects and restores the active project", () => {
    const first = createProject(submission("First"));
    const second = createProject(submission("Second"));
    writeSubmission({ ...submission("First updated"), nodes: [{ id: "first-node" }] }, first.id);

    setActiveProject(second.id);
    expect(readSubmission()?.applicationName).toBe("Second");
    expect(readSubmission(first.id)?.applicationName).toBe("First updated");
    expect(readSubmission(first.id)?.nodes).toEqual([{ id: "first-node" }]);
  });

  it("duplicates a project as an independent editable draft", () => {
    const original = createProject(submission("Submitted source"));

    writeSubmission(
      { ...readSubmission(original.id)!, status: "submitted" },
      original.id,
    );

    const copy = duplicateProject(original.id);

    expect(copy.id).not.toBe(original.id);
    expect(copy.status).toBe("draft");
    expect(copy.applicationName).toBe("Submitted source (copy)");
    expect(copy.nodes).toEqual(original.nodes);
    expect(
      listProjects().find((project) => project.id === original.id)?.status,
    ).toBe("submitted");
  });

  it("renames and deletes only the selected project", () => {
    const first = createProject(submission("First"));
    const second = createProject(submission("Second"));

    renameProject(first.id, "Renamed");
    deleteProject(second.id);

    expect(listProjects().map((project) => project.applicationName)).toContain("Renamed");
    expect(listProjects().some((project) => project.id === second.id)).toBe(false);
  });

  it("does not overwrite malformed legacy data during migration", () => {
    memory.set("breachx-design", "{invalid-json");

    expect(() => listProjects()).toThrow(/has not been deleted or overwritten/i);
    expect(memory.get("breachx-design")).toBe("{invalid-json");
    expect(memory.has("anchon-projects-v1")).toBe(false);
  });
});
