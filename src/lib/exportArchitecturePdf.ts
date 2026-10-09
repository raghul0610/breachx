type ExportNode = { id: string; position: { x: number; y: number }; data: { label: string; category: string; notes?: string } };
type ExportEdge = { source: string; target: string };
const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function exportArchitecturePdf(name: string, requirements: string, notes: string, nodes: ExportNode[], edges: ExportEdge[]) {
  const width = 210, height = 84, padding = 48;
  const canvasWidth = Math.max(720, ...nodes.map((n) => n.position.x + width)) + padding;
  const canvasHeight = Math.max(360, ...nodes.map((n) => n.position.y + height)) + padding;
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const paths = edges.map((edge) => {
    const a = byId.get(edge.source), b = byId.get(edge.target);
    if (!a || !b) return "";
    return '<path d="M '+(a.position.x+width/2)+' '+(a.position.y+height/2)+' L '+(b.position.x+width/2)+' '+(b.position.y+height/2)+'" stroke="#526477" stroke-width="2" fill="none" marker-end="url(#arrow)"/>';
  }).join("");
  const boxes = nodes.map((node) => '<g transform="translate('+node.position.x+','+node.position.y+')"><rect width="'+width+'" height="'+height+'" rx="10" fill="#f8fafc" stroke="#334155"/><text x="12" y="20" font-size="10" fill="#0369a1" font-weight="700">'+escapeHtml(node.data.category.toUpperCase())+'</text><text x="12" y="43" font-size="13" fill="#0f172a" font-weight="700">'+escapeHtml(node.data.label.slice(0,26))+'</text><text x="12" y="63" font-size="9" fill="#475569">'+escapeHtml((node.data.notes || "").slice(0,34))+'</text></g>').join("");
  const components = nodes.map((n) => '<li><strong>'+escapeHtml(n.data.label)+'</strong> ('+escapeHtml(n.data.category)+'): '+escapeHtml(n.data.notes || "No additional notes.")+'</li>').join("");
  const flows = edges.map((e) => '<li>'+escapeHtml(byId.get(e.source)?.data.label || e.source)+' → '+escapeHtml(byId.get(e.target)?.data.label || e.target)+'</li>').join("");
  const win = window.open("", "_blank");
  if (!win) { alert("Allow pop-ups to export the PDF."); return; }
  win.document.write('<!doctype html><html><head><title>'+escapeHtml(name)+'</title><style>body{font:14px Arial;color:#0f172a;margin:28px}h1{font-size:24px}p{line-height:1.5}.diagram{width:100%;max-height:65vh}@page{size:A4 landscape;margin:12mm}@media print{body{margin:0}.diagram{max-height:none}li{break-inside:avoid}}</style></head><body><h1>'+escapeHtml(name)+'</h1><p>'+escapeHtml(requirements)+'</p><svg class="diagram" viewBox="0 0 '+canvasWidth+' '+canvasHeight+'" xmlns="http://www.w3.org/2000/svg"><defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#526477"/></marker></defs><rect width="100%" height="100%" fill="white"/>'+paths+boxes+'</svg><h2>Components</h2><ul>'+components+'</ul><h2>Directed connections</h2><ul>'+flows+'</ul><h2>Architecture notes</h2><p>'+escapeHtml(notes || "No architecture notes supplied.")+'</p></body></html>');
  win.document.close();
  win.focus();
  win.print();
}
