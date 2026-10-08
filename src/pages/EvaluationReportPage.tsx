import {ArrowLeft,CheckCircle2} from "lucide-react";
import {readEvaluation} from "../lib/evaluationStorage";
export function EvaluationReportPage({onBack}:{onBack:()=>void}){
 const result=readEvaluation();
 if(!result)return <div className="app-shell"><header className="topbar"><button className="nav-btn" onClick={onBack}><ArrowLeft size={14}/> BACK</button><strong>DESIGN EVALUATION</strong></header><main className="admin-content"><section className="panel control-hero"><h1>NO REPORT</h1><p>Submit a system design first.</p></section></main></div>;
 return <div className="app-shell"><header className="topbar"><button className="nav-btn" onClick={onBack}><ArrowLeft size={14}/> BACK TO DESIGN</button><div><strong>DESIGN EVALUATION</strong><span className="topbar-sub"> // SYSTEM DESIGN REPORT</span></div><span className="status-pill">COMPLETE</span></header><main className="admin-content">
 <section className="panel control-hero"><div className="section-kicker">EVALUATION RESULT</div><h1>{result.score}/100</h1><p>{result.summary}</p></section>
 <section className="panel"><div className="section-kicker">SCORE BREAKDOWN</div>{result.scores.map(s=><div className="score-row" key={s.category}><div><strong>{s.category}</strong><small>{s.summary}</small></div><b>{s.score}/{s.maxScore}</b></div>)}</section>
 <section className="panel"><div className="section-kicker">STRENGTHS</div>{result.strengths.map(s=><p className="report-item" key={s}><CheckCircle2 size={14}/>{s}</p>)}</section>
 <section className="panel"><div className="section-kicker">FINDINGS</div>{result.findings.length?result.findings.map(f=><article className="finding" key={f.id}><div className="finding-head"><strong>{f.title}</strong><span className={"severity severity-"+f.severity}>{f.severity}</span></div><p>{f.description}</p><small>Evidence: {f.evidence.join(", ")}</small><p><b>Recommendation:</b> {f.recommendation}</p></article>):<p className="report-item"><CheckCircle2 size={14}/> No rule-based findings.</p>}</section>
 </main></div>;
}
