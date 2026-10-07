import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
export type BlueprintNodeData = {
  label: string;
  typeKey: string;
  category: string;
  notes?: string;
};
export const BlueprintNode = memo(({ data, selected }: NodeProps) => {
  const node = data as BlueprintNodeData;
  return (
    <div className={`bp-node ${selected ? "selected" : ""}`}>
      <Handle type="target" position={Position.Top} className="handle" />
      <Handle type="source" position={Position.Bottom} className="handle" />
      <Handle type="target" position={Position.Left} className="handle" />
      <Handle type="source" position={Position.Right} className="handle" />
      <div className="node-category">{node.category}</div>
      <div className="node-label">{node.label}</div>
      {node.notes ? <div className="node-notes">{node.notes}</div> : null}
    </div>
  );
});