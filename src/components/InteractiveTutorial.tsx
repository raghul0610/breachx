import { useState } from "react";
import { CircleHelp, X, ArrowUpRight } from "lucide-react";
import "./InteractiveTutorial.css";

const guides = {
  workspace: {
    title: "How to use the architecture workspace",
    intro: "Build, inspect and validate a system architecture from requirements to connected components.",
    steps: [
      ["1", "Start with the requirements", "Read the project brief and identify functional requirements, quality attributes, trust boundaries and data ownership."],
      ["2", "Browse the component library", "Search or filter the library. Drag a component onto the canvas, or select it to inspect its responsibility before adding it."],
      ["3", "Connect the nodes", "Each node has four connection handles: top, right, bottom and left. Drag from a handle to another node's handle to define request, data or event flow."],
      ["4", "Inspect and refine", "Select a node or connection to inspect its details. Use the inspector to understand the component and update its configuration."],
      ["5", "Ask ANCHON AI", "Open the ANCHON mark at the bottom-right. Planning proposes a design for your review; Agent applies the generated changes. The assistant opens on the right and closes competing panels."],
      ["6", "Evaluate and save", "Run the architecture evaluation, review findings, fix critical issues and save your blueprint. Use undo/redo when refining."],
    ],
  },
  dashboard: {
    title: "How to use the project dashboard",
    intro: "Create a project, open its workspace and track your architecture work.",
    steps: [
      ["1", "Create a project", "Start a project with a clear name and a short description of the system you want to design."],
      ["2", "Open the workspace", "Select a project to open its architecture canvas and requirements."],
      ["3", "Use the learning resources", "Open the guide or practice area whenever you need help with system-design concepts."],
      ["4", "Return to your project", "Your saved project is the starting point for the next design session."],
    ],
  },
  generator: {
    title: "How to use the architecture generator",
    intro: "Turn a system brief into a proposed architecture, then inspect and refine it.",
    steps: [
      ["1", "Describe the system", "Provide the use case, expected traffic, important workflows and reliability constraints."],
      ["2", "Review the proposal", "Inspect the generated components, connections, assumptions and design decisions."],
      ["3", "Apply and evaluate", "Apply the architecture to your workspace, then run evaluation and refine the design."],
    ],
  },
};

export function InteractiveTutorial({ page }: {
  page: "dashboard" | "workspace" | "generator";
  onStepChange?: (step: { selector: string; title: string; description: string; action?: string; activate?: "brief" | "component-library" | "inspector" | "canvas" | "ai-chat" }) => void;
}) {
  const [open, setOpen] = useState(false);
  const guide = guides[page];
  return <>
    <button type="button" className="tutorial-help-button" onClick={() => setOpen(true)} aria-label="Open application tutorial" title="How to use ANCHON">
      <CircleHelp size={17}/><span>HELP</span>
    </button>
    {open&&<div className="anchon-tutorial-backdrop" role="presentation" onClick={() => setOpen(false)}>
      <section className="anchon-tutorial-dialog" role="dialog" aria-modal="true" aria-labelledby="anchon-tutorial-title" onClick={event => event.stopPropagation()}>
        <header><div><span className="tutorial-kicker">ANCHON · QUICK START</span><h2 id="anchon-tutorial-title">{guide.title}</h2><p>{guide.intro}</p></div><button type="button" onClick={() => setOpen(false)} aria-label="Close tutorial"><X size={18}/></button></header>
        <ol>{guide.steps.map(([number,title,description])=><li key={number}><span className="tutorial-step-number">{number}</span><div><strong>{title}</strong><p>{description}</p></div></li>)}</ol>
        <footer><a href="https://github.com/raghul0610/breachx/blob/feat/anchon-assistant-floating-workspace/docs/anchon-user-guide.md" target="_blank" rel="noopener noreferrer">Read the full user guide <ArrowUpRight size={13}/></a><button type="button" onClick={() => setOpen(false)}>Got it</button></footer>
      </section>
    </div>}
  </>;
}
