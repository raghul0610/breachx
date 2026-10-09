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
  const nw = 230, nh = 106, pad = 56;
  const minX = Math.min(0, ...nodes.map(n => n.position.x));
  const minY = Math.min(0, ...nodes.map(n => n.position.y));
  const dw = Math.max(900, ...nodes.map(n => n.position.x + nw)) - minX + pad * 2;
  const dh = Math.max(430, ...nodes.map(n => n.position.y + nh)) - minY + pad * 2;
  const x = (n: ExportNode) => n.position.x - minX + pad;
  const y = (n: ExportNode) => n.position.y - minY + pad;
  const byId = new Map(nodes.map(n => [n.id, n]));
  const paths = edges.map(e => {
    const a = byId.get(e.source), b = byId.get(e.target);
    if (!a || !b) return "";
    const x1 = x(a) + nw / 2, y1 = y(a) + nh / 2, x2 = x(b) + nw / 2, y2 = y(b) + nh / 2;
    const curve = Math.max(35, Math.min(120, Math.abs(x2 - x1) * .25));
    const c1 = x1 + (x2 >= x1 ? curve : -curve), c2 = x2 - (x2 >= x1 ? curve : -curve);
    return '<path d="M '+x1+' '+y1+' C '+c1+' '+y1+', '+c2+' '+y2+', '+x2+' '+y2+'" stroke="#71849b" stroke-width="2.5" fill="none" marker-end="url(#arrow)"/>';
  }).join("");
  const palette = ["#0e7490", "#2563eb", "#7c3aed", "#0f766e", "#c2410c"];
  const boxes = nodes.map((n, i) => {
    const category = (n.data.category || "Component").toUpperCase();
    const labelLines = wrap(n.data.label || "Untitled component", 24).slice(0, 2);
    const labels = labelLines.map((line, j) => '<text x="18" y="'+(64+j*19)+'" font-size="15" fill="#10233f" font-weight="700">'+esc(line)+'</text>').join("");
    const accent = palette[i % palette.length];
    const tagWidth = Math.min(145, Math.max(65, category.length * 7 + 18));
    const note = wrap(n.data.notes || "Architecture component", 34)[0] || "Architecture component";
    return '<g transform="translate('+x(n)+','+y(n)+')"><rect x="3" y="5" width="'+nw+'" height="'+nh+'" rx="14" fill="#0f172a" opacity=".08"/><rect width="'+nw+'" height="'+nh+'" rx="14" fill="#fff" stroke="#d7e1ed" stroke-width="1.4"/><path d="M14 0 H'+(nw-14)+' Q'+nw+' 0 '+nw+' 14 V18 H0 V14 Q0 0 14 0Z" fill="'+accent+'"/><rect x="16" y="28" width="'+tagWidth+'" height="18" rx="9" fill="'+accent+'" opacity=".12"/><text x="25" y="40" font-size="9" letter-spacing=".7" fill="'+accent+'" font-weight="700">'+esc(category.slice(0, 20))+'</text>'+labels+'<text x="18" y="94" font-size="10" fill="#64748b">'+esc(note.slice(0, 36))+'</text></g>';
  }).join("");
  const componentCards = nodes.map((n, i) => '<article class="component"><div class="number">'+String(i+1).padStart(2,"0")+'</div><div><div class="category">'+esc(n.data.category || "Component")+'</div><h3>'+esc(n.data.label || "Untitled component")+'</h3><p>'+esc(n.data.notes || "No component-specific rationale was provided.")+'</p></div></article>').join("");
  const connectionRows = edges.map((e, i) => '<div class="connection"><span class="number">'+String(i+1).padStart(2,"0")+'</span><strong>'+esc(byId.get(e.source)?.data.label || e.source)+'</strong><span class="arrow">â†’</span><strong>'+esc(byId.get(e.target)?.data.label || e.target)+'</strong></div>').join("");
  const date = new Date().toLocaleDateString(undefined, {year:"numeric", month:"long", day:"numeric"});
  const safeName = esc(name || "System Architecture"), safeReq = esc(requirements || "No application requirements supplied."), safeNotes = esc(notes || "No architecture notes supplied.");
  const win = window.open("", "_blank");
  if (!win) { alert("Allow pop-ups for this site to export the architecture PDF."); return; }
  win.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${safeName} â€” Architecture Blueprint</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#e9eef5;color:#10233f;font:14px/1.55 Inter,system-ui,-apple-system,"Segoe UI",sans-serif}.report{max-width:1180px;margin:28px auto;background:#fff;box-shadow:0 18px 55px #0f172a16}.cover{padding:34px 42px 30px;background:#10233f;color:#fff;position:relative;overflow:hidden}.cover:after{content:"";position:absolute;width:340px;height:340px;border:1px solid #ffffff1a;border-radius:50%;right:-80px;top:-180px;box-shadow:0 0 0 35px #ffffff08,0 0 0 70px #ffffff05}.brand-row{display:flex;justify-content:space-between;gap:20px;border-bottom:1px solid #ffffff24;padding-bottom:18px;position:relative;z-index:1}.brand{font-size:12px;letter-spacing:2.8px;font-weight:800}.brand span,.cover .eyebrow{color:#67e8f9}.doc-type{font-size:10px;letter-spacing:1.6px;color:#b8c9dc;text-transform:uppercase}.cover-main{position:relative;z-index:1;padding:30px 0 10px;max-width:850px}.eyebrow{font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#64748b}h1{font-size:34px;line-height:1.13;letter-spacing:-.8px;margin:10px 0 14px;overflow-wrap:anywhere}.cover p{color:#d1deec;max-width:780px;margin:0;font-size:13px;line-height:1.8}.meta{display:flex;gap:32px;flex-wrap:wrap;margin-top:25px;color:#c2d1e2;font-size:10px;text-transform:uppercase;letter-spacing:1px}.meta strong{display:block;color:#fff;font-size:12px;letter-spacing:0;text-transform:none;margin-top:4px}main{padding:28px 42px 38px}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:28px}.stat{padding:15px 17px;background:#f3f7fb;border:1px solid #dbe4ef;border-radius:10px}.stat strong{font-size:24px;display:block;line-height:1.2}.stat span{font-size:9px;text-transform:uppercase;letter-spacing:1.2px;color:#64748b;font-weight:800}.section{margin-top:30px}.section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin:0 0 16px}.section-head h2{font-size:17px;margin:3px 0 0}.section-note{font-size:10px;color:#64748b}.diagram-wrap{border:1px solid #dbe4ef;border-radius:12px;overflow:hidden;background:#f8fafc}.diagram-banner{padding:12px 16px;border-bottom:1px solid #dbe4ef;background:#fff;display:flex;justify-content:space-between}.diagram-banner strong{font-size:11px;letter-spacing:.5px}.diagram-banner span{font-size:10px;color:#64748b}.diagram{display:block;width:100%;height:auto;background:#f8fafc}.component-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.component{display:flex;gap:13px;border:1px solid #dbe4ef;border-radius:10px;padding:15px;background:#fff;break-inside:avoid;min-width:0}.number{font-size:11px;font-weight:800;color:#0e7490;background:#e5f7fb;border-radius:7px;min-width:31px;height:31px;display:grid;place-items:center}.category{font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#64748b;font-weight:800}.component h3{font-size:13px;margin:3px 0 5px;overflow-wrap:anywhere}.component p{font-size:11px;color:#526477;margin:0;line-height:1.65;overflow-wrap:anywhere}.connection-list{border:1px solid #dbe4ef;border-radius:10px;overflow:hidden}.connection{display:grid;grid-template-columns:34px minmax(0,1fr) 24px minmax(0,1fr);gap:10px;align-items:center;padding:11px 14px;border-bottom:1px solid #e8eef5;break-inside:avoid}.connection:last-child{border-bottom:0}.connection strong{font-size:11px;overflow-wrap:anywhere}.arrow{color:#0e7490;font-size:18px;text-align:center}.text-panel{background:#f3f7fb;border:1px solid #dbe4ef;border-radius:10px;padding:18px 20px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;line-height:1.8;color:#334155}.footer{margin-top:34px;padding-top:14px;border-top:1px solid #dbe4ef;display:flex;justify-content:space-between;gap:16px;color:#94a3b8;font-size:9px;letter-spacing:.5px;text-transform:uppercase}
@page{size:A4 landscape;margin:0}@media print{body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}.report{max-width:none;margin:0;box-shadow:none}.cover{padding:12mm 14mm 9mm;min-height:78mm}main{padding:8mm 14mm 10mm}.diagram{width:100%;max-height:155mm}.diagram-wrap,.component,.connection,.stat{break-inside:avoid}.component-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media screen and (max-width:760px){.report{margin:0}.cover,main{padding:24px}.component-grid{grid-template-columns:1fr}.stats{gap:7px}.stat{padding:12px}.stat strong{font-size:20px}}
</style></head><body><div class="report">
<header class="cover"><div class="brand-row"><div class="brand">BREACH <span>X</span></div><div class="doc-type">System architecture blueprint</div></div><div class="cover-main"><div class="eyebrow">Architecture document Â· ${date}</div><h1>${safeName}</h1><p>${safeReq}</p><div class="meta"><div>DOCUMENT TYPE<strong>System architecture</strong></div><div>STATUS<strong>Design blueprint</strong></div><div>VERSION<strong>01 Â· Workspace export</strong></div></div></div></header>
<main><div class="stats"><div class="stat"><strong>${nodes.length}</strong><span>Architecture components</span></div><div class="stat"><strong>${edges.length}</strong><span>Directed connections</span></div><div class="stat"><strong>${new Set(nodes.map(n=>n.data.category)).size}</strong><span>Component categories</span></div></div>
<section><div class="section-head"><div><div class="eyebrow">01 / System overview</div><h2>Architecture diagram</h2></div><div class="section-note">Arrows indicate direction of flow</div></div><div class="diagram-wrap"><div class="diagram-banner"><strong>LOGICAL COMPONENT TOPOLOGY</strong><span>${nodes.length} nodes Â· ${edges.length} edges</span></div><svg class="diagram" viewBox="0 0 ${dw} ${dh}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="System architecture diagram"><defs><pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#d9e3ef"/></pattern><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#71849b"/></marker></defs><rect width="100%" height="100%" fill="url(#grid)"/>${paths}${boxes}</svg></div></section>
<section class="section"><div class="section-head"><div><div class="eyebrow">02 / Component inventory</div><h2>Building blocks & responsibilities</h2></div></div><div class="component-grid">${componentCards || '<p>No components in this architecture.</p>'}</div></section>
<section class="section"><div class="section-head"><div><div class="eyebrow">03 / Interaction model</div><h2>Directed connections</h2></div><div class="section-note">Source â†’ target</div></div><div class="connection-list">${connectionRows || '<div class="connection">No connections defined.</div>'}</div></section>
<section class="section"><div class="section-head"><div><div class="eyebrow">04 / Design rationale</div><h2>Architecture notes</h2></div></div><div class="text-panel">${safeNotes}</div></section>
<div class="footer"><span>Breach X Â· Architecture Designer</span><span>Project documentation Â· ${date}</span></div></main></div><script>window.addEventListener("load",()=>setTimeout(()=>window.print(),350));</script></body></html>`);
  win.document.close();
  win.focus();
}

