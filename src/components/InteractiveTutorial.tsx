import { useCallback, useEffect, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, CircleHelp, RotateCcw, X } from "lucide-react";

type TutorialStep = {
  selector: string;
  title: string;
  description: string;
  action?: string;
  activate?: "brief" | "component-library" | "inspector" | "canvas" | "ai-chat";
};

const TUTORIALS: Record<string, { title: string; steps: TutorialStep[] }> = {
  dashboard: {
    title: "Project workspace tour",
    steps: [
      { selector: "[data-tutorial='new-project']", title: "Create a project", description: "Start a separate architecture for each application. ANCHON opens the editor after creating it.", action: "Use New Project when you are ready to start." },
      { selector: "[data-tutorial='project-grid']", title: "Your saved architectures", description: "Projects appear here with their component and connection counts. Open a project to continue editing it." },
      { selector: "[data-tutorial='project-actions']", title: "Manage a project", description: "Open a project, rename it, duplicate it, or delete it. Deletion asks for confirmation first." },
    ],
  },
  workspace: {
    title: "Architecture workspace tour",
    steps: [
      { selector: ".topbar", title: "1. Workspace controls", description: "The top bar keeps the project identity, cloud-save status, Undo, Redo, Export PDF, Save Draft, and Save Blueprint & Continue together. Watch the save status before leaving." },
      { selector: "[data-tutorial='requirements']", title: "2. Project brief", description: "The brief sidebar starts collapsed to give the canvas more room. Open BRIEF from the left edge to edit the project name and review component and connection counts.", activate: "brief" },
      { selector: "[data-tutorial='component-library']", title: "3. Component library popup", description: "Browse the component library. The Inspector opens alongside it; choosing a catalog item shows its details without adding it to the canvas.", activate: "component-library" },
      { selector: "[data-tutorial='create-component']", title: "4. Add components", description: "Select a component and choose Add Component. You can also drag a component card onto the canvas.", activate: "component-library" },
      { selector: "[data-tutorial='canvas']", title: "5. Canvas", description: "Arrange nodes on the canvas, connect handles to show flow, and use zoom controls to navigate.", activate: "canvas" },
      { selector: "[data-tutorial='inspector']", title: "6. Inspector", description: "Review catalog details, edit a component, or delete the selected component or connection.", activate: "inspector" },
      { selector: "[data-tutorial='architecture-ai-chat']", title: "7. Ask ANCHON", description: "Open Ask ANCHON to plan or apply architecture changes, then review generated changes before saving.", activate: "ai-chat" },
      { selector: "[data-tutorial-connections='true']", title: "8. Connect components", description: "Drag from one component handle to another to create a directed connection. Select an edge to open its details in the Inspector or delete it." },
      { selector: "[data-tutorial='save-draft']", title: "9. Save your work", description: "Changes autosave and the top-right status shows progress. Save Draft explicitly persists your current design; use it if you want confirmation before leaving." },
      { selector: "[data-tutorial='export-pdf']", title: "10. Export PDF", description: "Export PDF creates a shareable document from the current architecture. Review its layout and content before using it as project documentation." },
      { selector: "[data-tutorial='continue']", title: "11. Save blueprint & continue", description: "Use this when your design is ready for the next workflow. ANCHON requires a description, at least three components, and two connections. You can keep editing or export the design afterward." },
    ],
  },
  generator: {
    title: "AI generator tour",
    steps: [
      { selector: "[data-tutorial='generator-name']", title: "1. Name the application", description: "Give the system a short, descriptive name so the generated proposal is easy to identify." },
      { selector: "[data-tutorial='generator-requirements']", title: "2. Describe requirements", description: "Explain the purpose, features, traffic, data, security, availability, and integrations. The Generate button becomes available when the name and description meet its minimum length." },
      { selector: "[data-tutorial='generate']", title: "3. Generate and review", description: "Generate Architecture sends the requirements to the configured generation endpoint. Review all components, directed connections, assumptions, and design decisions before opening the proposal in the editor." },
      { selector: "[data-tutorial='open-generated']", title: "4. Edit the proposal", description: "After a proposal is generated, use this button to create a draft project in the designer. Generated output is a starting point, not a production-validated design." },
    ],
  },
};

export function InteractiveTutorial({ page, onStepChange }: { page: "dashboard" | "workspace" | "generator"; onStepChange?: (step: { selector: string; title: string; description: string; action?: string; activate?: "brief" | "component-library" | "inspector" | "canvas" | "ai-chat" }) => void }) {
  const tutorial = TUTORIALS[page];
  const storageKey = `anchon:tutorial-complete:${page}:v1`;
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const current = tutorial.steps[stepIndex];

  const clearHighlight = useCallback(() => {
    document.querySelectorAll(".tutorial-target-active").forEach((element) => element.classList.remove("tutorial-target-active"));
  }, []);

  const start = useCallback((index = 0) => {
    setStepIndex(index);
    setOpen(true);
  }, []);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(storageKey) !== "done") {
        const timer = window.setTimeout(() => start(), 650);
        return () => window.clearTimeout(timer);
      }
    } catch {
      // The tutorial remains available through the Help button if storage is unavailable.
    }
  }, [start, storageKey]);

  useEffect(() => {
    if (!open || !current) return;
    clearHighlight();
    onStepChange?.(current);
    const target = document.querySelector<HTMLElement>(current.selector);
    if (target) {
      target.classList.add("tutorial-target-active");
      target.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
    return clearHighlight;
  }, [open, current, clearHighlight, onStepChange]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
      if (event.key === "ArrowRight") advance();
      if (event.key === "ArrowLeft") setStepIndex((value) => Math.max(0, value - 1));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function finish() {
    clearHighlight();
    setOpen(false);
    if (dontShowAgain) {
      try { window.localStorage.setItem(storageKey, "done"); } catch { /* storage may be disabled */ }
    }
  }

  function advance() {
    if (stepIndex < tutorial.steps.length - 1) {
      setStepIndex((value) => value + 1);
    } else {
      try { window.localStorage.setItem(storageKey, "done"); } catch { /* storage may be disabled */ }
      clearHighlight();
      setOpen(false);
    }
  }

  return (
    <>
      <button className="tutorial-help-button" type="button" onClick={() => start()} aria-label={`Open ${tutorial.title}`} title="Open interactive tutorial">
        <CircleHelp size={16} /><span>HELP</span>
      </button>
      {open && current && (
        <div className="tutorial-layer" role="presentation">
          <button className="tutorial-scrim" aria-label="Close tutorial" onClick={finish} />
          <section className="tutorial-card" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
            <div className="tutorial-card-top">
              <span><BookOpen size={14} /> ANCHON GUIDE</span>
              <button type="button" onClick={finish} aria-label="Close tutorial"><X size={16} /></button>
            </div>
            <div className="tutorial-progress-label">{stepIndex + 1} OF {tutorial.steps.length} · {tutorial.title}</div>
            <div className="tutorial-progress-track"><span style={{ width: `${((stepIndex + 1) / tutorial.steps.length) * 100}%` }} /></div>
            <h2 id="tutorial-title">{current.title}</h2>
            <p>{current.description}</p>
            {current.action && <p className="tutorial-action-note">{current.action}</p>}
            <label className="tutorial-dismiss-option">
              <input type="checkbox" checked={dontShowAgain} onChange={(event) => setDontShowAgain(event.target.checked)} />
              Don't show automatically again
            </label>
            <div className="tutorial-card-actions">
              <button type="button" className="tutorial-text-button" onClick={() => start()}><RotateCcw size={13} /> Restart</button>
              <button type="button" className="tutorial-text-button" onClick={finish}>Skip</button>
              <div className="tutorial-nav-actions">
                <button type="button" className="tutorial-secondary-button" onClick={() => setStepIndex((value) => Math.max(0, value - 1))} disabled={stepIndex === 0} aria-label="Previous step"><ChevronLeft size={15} /> Back</button>
                <button type="button" className="tutorial-primary-button" onClick={advance}>{stepIndex === tutorial.steps.length - 1 ? "Finish" : "Next"} <ChevronRight size={15} /></button>
              </div>
            </div>
            <p className="tutorial-keyboard-hint">Tip: use ← and → to navigate, or Esc to close.</p>
          </section>
        </div>
      )}
    </>
  );
}
