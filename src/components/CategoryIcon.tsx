import {
  Activity,
  Boxes,
  BrainCircuit,
  BriefcaseBusiness,
  Cloud,
  Code2,
  Database,
  Gauge,
  Globe2,
  HardDrive,
  Layers3,
  Network,
  RadioTower,
  Route,
  ShieldCheck,
  Workflow,
  type LucideIcon,
} from "lucide-react";

type CategoryVisual = { icon: LucideIcon; tone: string };

const DEFAULT_VISUAL: CategoryVisual = { icon: Boxes, tone: "neutral" };

const CATEGORY_VISUALS: Record<string, CategoryVisual> = {
  Edge: { icon: Globe2, tone: "edge" },
  Security: { icon: ShieldCheck, tone: "security" },
  Network: { icon: Network, tone: "network" },
  Routing: { icon: Route, tone: "routing" },
  Compute: { icon: Boxes, tone: "compute" },
  API: { icon: Code2, tone: "api" },
  Realtime: { icon: RadioTower, tone: "realtime" },
  Integration: { icon: Workflow, tone: "integration" },
  Data: { icon: Database, tone: "data" },
  Analytics: { icon: Activity, tone: "analytics" },
  Storage: { icon: HardDrive, tone: "storage" },
  Reliability: { icon: Gauge, tone: "reliability" },
  Messaging: { icon: RadioTower, tone: "messaging" },
  Orchestration: { icon: Workflow, tone: "orchestration" },
  Observability: { icon: Activity, tone: "observability" },
  Platform: { icon: Layers3, tone: "platform" },
  External: { icon: Cloud, tone: "external" },
  Banking: { icon: BriefcaseBusiness, tone: "banking" },
  "AI / ML": { icon: BrainCircuit, tone: "ai" },
};

const CATEGORY_ACCENTS: Record<string, string> = {
  edge: "#38bdf8",
  security: "#fb7185",
  network: "#60a5fa",
  routing: "#818cf8",
  compute: "#a78bfa",
  api: "#22d3ee",
  realtime: "#2dd4bf",
  integration: "#34d399",
  data: "#fbbf24",
  analytics: "#facc15",
  storage: "#f59e0b",
  reliability: "#4ade80",
  messaging: "#c084fc",
  orchestration: "#e879f9",
  observability: "#2dd4bf",
  platform: "#94a3b8",
  external: "#fb923c",
  banking: "#f87171",
  ai: "#c4b5fd",
  neutral: "#94a3b8",
};

export function getCategoryVisual(category: string): CategoryVisual {
  return CATEGORY_VISUALS[category] ?? DEFAULT_VISUAL;
}

export function getCategoryAccent(category: string): string {
  return CATEGORY_ACCENTS[getCategoryVisual(category).tone] ?? CATEGORY_ACCENTS.neutral;
}

export function CategoryIcon({
  category,
  size = 14,
  className,
}: {
  category: string;
  size?: number;
  className?: string;
}) {
  const visual = getCategoryVisual(category);
  const Icon = visual.icon;
  return <Icon size={size} strokeWidth={1.8} className={className} aria-hidden="true" />;
}
