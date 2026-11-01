import { CircleHelp } from "lucide-react";

const ANCHON_USER_GUIDE_URL =
  "https://github.com/raghul0610/breachx/blob/feat/anchon-assistant-floating-workspace/docs/anchon-user-guide.md";

export function InteractiveTutorial({ page }: {
  page: "dashboard" | "workspace" | "generator";
  onStepChange?: (step: { selector: string; title: string; description: string; action?: string; activate?: "brief" | "component-library" | "inspector" | "canvas" | "ai-chat" }) => void;
}) {
  const label = page === "workspace" ? "Open ANCHON user guide" : "Open ANCHON getting-started guide";

  return (
    <a
      className="tutorial-help-button"
      href={ANCHON_USER_GUIDE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
    >
      <CircleHelp size={16} />
      <span>HELP</span>
    </a>
  );
}
