import { useCallback, useEffect, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, CircleHelp, RotateCcw, X } from "lucide-react";

type TutorialStep = {
  selector: string;
  title: string;
  description: string;
  action?: string;
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
      { selector: "[data-tutorial='requirements']", title: "1. Describe your system", description: "Enter an application name, its requirements, and any design constraints. Specific requirements make architecture decisions easier to explain." },
      { selector: "[data-tutorial='component-library']", title: "2. Explore the component library", description: "Browse components by system layer. Selecting a component opens its explanation in the Inspector; it does not add it to the canvas yet." },
      { selector: "[data-tutorial='create-component']", title: "3. Add a component", description: "Click a component in the library, then use this button. You can also drag a component directly onto the canvas." },
      { selector: "[data-tutorial='canvas']", title: "4. Arrange your architecture", description: "Move components to organize the diagram. Use the zoom controls to navigate. The starter diagram is editable." },
      { selector: "[data-tutorial='inspector']", title: "5. Learn and edit", description: "Select a library item to learn what it does and when to use it. Select a canvas component to edit its label or rationale." },
      { selector: "[data-tutorial='connections']", title: "6. Connect components", description: "Drag from a component's connection handle to another component's handle. The arrow indicates the direction of the flow. Select a connection to inspect or delete it." },
      { selector: "[data-tutorial='save-draft']", title: "7. Save your work", description: "The editor autosaves changes and shows the current save status. Save Draft performs an explicit save; use it before leaving if you want confirmation." },
      { selector: "[data-tutorial='export-pdf']", title: "8. Export a blueprint", description: "Export PDF creates a shareable document from the current architecture. Review the layout and content before using it as project documentation." },
      { selector: "[data-tutorial='continue']", title: "9. Continue to AI tools", description: "When the design meets the minimum requirements, save the blueprint and continue to the next workflow. ANCHON requires a description, at least three components, and two connections." },
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

export function InteractiveTutorial({ page }: { page: "dashboard" | "workspace" | "generator" }) {
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
    const target = document.querySelector<HTMLElement>(current.selector);
    if (target) {
      target.classList.add("tutorial-target-active");
      target.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
    return clearHighlight;
  }, [open, current, clearHighlight]);

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
