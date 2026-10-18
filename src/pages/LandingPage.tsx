import { InteractiveArchitectureLanding } from "../components/InteractiveArchitectureLanding";

export function LandingPage({
  onOpenDesigner,
}: {
  onOpenDesigner: () => void;
}) {
  return <InteractiveArchitectureLanding onOpenDesigner={onOpenDesigner} />;
}
