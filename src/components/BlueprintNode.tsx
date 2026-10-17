import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { CategoryIcon, getCategoryVisual } from "./CategoryIcon";
import "../categoryVisuals.css";

export type BlueprintNodeData = {
  label: string;
  typeKey: string;
  category: string;
  notes?: string;
};

export const BlueprintNode = memo(({ data, selected }: NodeProps) => {
  const node = data as BlueprintNodeData;
  const visual = getCategoryVisual(node.category);
  return (
    <div className={`bp-node bp-node--${visual.tone} ${selected ? "selected" : ""}`}>
      <Handle type="target" position={Position.Top} className="handle" />
      <Handle type="source" position={Position.Bottom} className="handle" />
      <Handle type="target" position={Position.Left} className="handle" />
      <Handle type="source" position={Position.Right} className="handle" />
      <div className="node-heading">
        <span className="node-category-icon"><CategoryIcon category={node.category} size={12} /></span>
        <span className="node-category">{node.category}</span>
      </div>
      <div className="node-label" title={node.notes?.trim() ? `${node.label}: ${node.notes.trim().slice(0, 140)}${node.notes.trim().length > 140 ? "…" : ""}` : `${node.label} · ${node.category} component`}>{node.label}</div>
      {node.notes ? <div className="node-notes">{node.notes}</div> : null}
    </div>
  );
});
