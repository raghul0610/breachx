import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { AlertTriangle } from "lucide-react";
import { CategoryIcon, getCategoryVisual } from "./CategoryIcon";
import "../categoryVisuals.css";
import "../architectureWorkspaceRefresh.css";

export type BlueprintNodeData = {
  label: string;
  typeKey: string;
  category: string;
  notes?: string;
  evaluationSeverity?: "critical" | "high" | "medium" | "low";
  evaluationCount?: number;
};

export const BlueprintNode = memo(({ data, selected }: NodeProps) => {
  const node = data as BlueprintNodeData;
  const visual = getCategoryVisual(node.category);
  return (
    <div className={`bp-node bp-node--${visual.tone} bp-node--kind-${node.typeKey.replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase()} ${selected ? "selected" : ""} ${node.evaluationSeverity ? `bp-node--issue bp-node--issue-${node.evaluationSeverity}` : ""}`}>
      {node.evaluationSeverity && <span className={`bp-node-issue-badge bp-node-issue-badge--${node.evaluationSeverity}`} title={`${node.evaluationCount ?? 1} evaluation finding(s) · ${node.evaluationSeverity} severity`}><AlertTriangle size={13} /><span>{node.evaluationCount}</span></span>}
      <Handle type="target" position={Position.Top} className="handle" />
      <Handle type="source" position={Position.Bottom} className="handle" />
      <Handle type="target" position={Position.Left} className="handle" />
      <Handle type="source" position={Position.Right} className="handle" />
      <div className="node-heading">
        <span className="node-category-icon"><CategoryIcon category={node.category} size={15} /></span>
        <span className="node-category">{node.category}</span>
      </div>
      <div className="node-label" title={node.label}>{node.label}</div>
      {node.notes?.trim() ? <div className="node-notes">{node.notes}</div> : <div className="node-notes">AI-ready architecture component</div>}
    </div>
  );
});
