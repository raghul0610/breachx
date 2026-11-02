import { jsPDF } from "jspdf";

type ExportNode = { id: string; position: { x: number; y: number }; data: { label: string; category: string; notes?: string } };
type ExportEdge = { source: string; target: string };
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const wrap = (s: string, max: number) => {
  const lines: string[] = [];
  let line = "";
  for (const word of s.trim().split(/\\s+/)) {
    if (line && (line + " " + word).length > max) { lines.push(line); line = word; }
    else line = line ? line + " " + word : word;
  }
  if (line) lines.push(line);
  return lines;
};

export function exportArchitecturePdf(name: string, requirements: string, notes: string, nodes: ExportNode[], edges: ExportEdge[]) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = 297, pageHeight = 210, margin = 16;
  type Rgb = [number, number, number];
  const graphite: Rgb = [20, 25, 28], silver: Rgb = [218, 225, 229], muted: Rgb = [116, 130, 139];
  const title = name || "System Architecture";
  const text = (value: string, x: number, y: number, size = 10, color: Rgb = [35, 44, 49], style: "normal" | "bold" = "normal") => { doc.setFont("helvetica", style); doc.setFontSize(size); doc.setTextColor(...color); doc.text(value, x, y); };
  const wrapped = (value: string, width: number) => doc.splitTextToSize(value || "Architecture component", width) as string[];
  doc.setFillColor(...graphite); doc.rect(0, 0, pageWidth, pageHeight, "F");
  doc.setDrawColor(96, 108, 116); doc.setLineWidth(.3); doc.line(margin, 28, pageWidth - margin, 28);
  text("ANCHON", margin, 20, 13, silver, "bold"); text("SYSTEM ARCHITECTURE BLUEPRINT", pageWidth - margin, 20, 8, muted, "bold");
  text("ARCHITECTURE DESIGN", margin, 48, 9, [160, 174, 181], "bold");
  wrapped(title, 220).slice(0, 2).forEach((line, index) => text(line, margin, 64 + index * 12, 27, [242, 246, 247], "bold"));
  wrapped(requirements || "No application requirements supplied.", 180).slice(0, 4).forEach((line, index) => text(line, margin, 100 + index * 6, 10, [174, 187, 193]));
  text(`${nodes.length} COMPONENTS`, margin, 143, 9, silver, "bold"); text(`${edges.length} CONNECTIONS`, margin + 43, 143, 9, silver, "bold"); text(`${new Set(nodes.map(node => node.data.category)).size} CATEGORIES`, margin + 91, 143, 9, silver, "bold");
  text("DESIGNED WITH ANCHON", margin, pageHeight - 15, 8, muted, "bold"); text(new Date().toLocaleDateString(), pageWidth - margin, pageHeight - 15, 8, muted);

  doc.addPage(); doc.setFillColor(246, 248, 249); doc.rect(0, 0, pageWidth, pageHeight, "F");
  text("01 / SYSTEM OVERVIEW", margin, 18, 8, [91, 108, 117], "bold"); text("Logical component topology", margin, 29, 18, graphite, "bold"); text("Directed flow · silver graphite system", pageWidth - margin, 28, 8, muted);
  const diagram = { x: margin, y: 38, w: pageWidth - margin * 2, h: 92 };
  doc.setFillColor(232, 236, 238); doc.roundedRect(diagram.x, diagram.y, diagram.w, diagram.h, 4, 4, "F");
  const minX = Math.min(0, ...nodes.map(node => node.position.x)), minY = Math.min(0, ...nodes.map(node => node.position.y));
  const maxX = Math.max(1, ...nodes.map(node => node.position.x)), maxY = Math.max(1, ...nodes.map(node => node.position.y));
  const px = (node: ExportNode) => diagram.x + 10 + ((node.position.x - minX) / Math.max(1, maxX - minX)) * (diagram.w - 20);
  const py = (node: ExportNode) => diagram.y + 12 + ((node.position.y - minY) / Math.max(1, maxY - minY)) * (diagram.h - 24);
  const byId = new Map(nodes.map(node => [node.id, node]));
  doc.setDrawColor(142, 155, 162); doc.setLineWidth(.5);
  edges.forEach(edge => { const source = byId.get(edge.source), target = byId.get(edge.target); if (!source || !target) return; doc.line(px(source), py(source), px(target), py(target)); });
  nodes.forEach(node => { const x = px(node) - 16, y = py(node) - 8; doc.setFillColor(...graphite); doc.setDrawColor(102, 116, 124); doc.roundedRect(x, y, 32, 16, 2.5, 2.5, "FD"); doc.setFillColor(188, 199, 205); doc.circle(x + 5, y + 5, 2.4, "F"); text((node.data.category || "C").slice(0, 1).toUpperCase(), x + 3.8, y + 6.2, 4.5, graphite, "bold"); wrapped(node.data.label || "Untitled component", 25).slice(0, 1).forEach(line => text(line, x + 9, y + 6.2, 5.2, [237, 242, 244], "bold")); text((node.data.category || "COMPONENT").toUpperCase().slice(0, 17), x + 9, y + 11.5, 3.5, [161, 175, 182]); });
  text("02 / COMPONENT INVENTORY", margin, 148, 8, [91, 108, 117], "bold");
  let inventoryY = 158; nodes.slice(0, 4).forEach((node, index) => { const column = index % 2, row = Math.floor(index / 2); const x = margin + column * 132, y = inventoryY + row * 16; text(String(index + 1).padStart(2, "0"), x, y, 8, [99, 114, 122], "bold"); text(node.data.label || "Untitled component", x + 12, y, 8, graphite, "bold"); text(node.data.category || "Component", x + 12, y + 5, 6.5, muted); });
  if (nodes.length > 4) text(`+ ${nodes.length - 4} more components listed in the architecture workspace`, margin, 195, 7, muted);
  doc.addPage(); doc.setFillColor(246, 248, 249); doc.rect(0, 0, pageWidth, pageHeight, "F");
  text("03 / REVIEW NOTES", margin, 18, 8, [91, 108, 117], "bold"); text("Design rationale & directed connections", margin, 29, 18, graphite, "bold");
  let y = 45; text("ARCHITECTURE NOTES", margin, y, 8, muted, "bold"); y += 8; wrapped(notes || "No architecture notes supplied.", pageWidth - margin * 2).slice(0, 10).forEach(line => { text(line, margin, y, 9, [65, 77, 84]); y += 5; });
  y += 9; text("DIRECTED CONNECTIONS", margin, y, 8, muted, "bold"); y += 8; edges.slice(0, 10).forEach((edge, index) => { const source = byId.get(edge.source)?.data.label || edge.source, target = byId.get(edge.target)?.data.label || edge.target; text(`${String(index + 1).padStart(2, "0")}  ${source}  →  ${target}`, margin, y, 8.5, graphite, "bold"); y += 7; });
  doc.save(`anchon-architecture-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "blueprint"}.pdf`);
}

