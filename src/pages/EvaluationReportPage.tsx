import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { readEvaluation } from "../lib/evaluationStorage";

export function EvaluationReportPage({ onBack }: { onBack: () => void }) {
  const result = readEvaluation();

  if (!result) {
    return (
      <div className="app-shell">
        <header className="topbar">
          <button className="nav-btn" onClick={onBack}>
            <ArrowLeft size={14} /> BACK
          </button>
          <strong>DESIGN EVALUATION</strong>
        </header>
        <main className="admin-content">
          <section className="panel control-hero">
            <h1>NO REPORT</h1>
            <p>Submit a system design first.</p>
          </section>
        </main>
      </div>
    );
  }

  const requirements = result.requirements;

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="nav-btn" onClick={onBack}>
          <ArrowLeft size={14} /> BACK TO DESIGN
        </button>
        <div>
          <strong>DESIGN EVALUATION</strong>
          <span className="topbar-sub"> // SYSTEM DESIGN REPORT</span>
        </div>
        <span className="status-pill">COMPLETE</span>
      </header>

      <main className="admin-content">
        <section className="panel control-hero">
          <div className="section-kicker">EVALUATION RESULT</div>
          <h1>{result.score}/100</h1>
          <p>{result.summary}</p>
          <div className="tiny">
            {result.evaluationMode === "hybrid"
              ? `HYBRID REVIEW · ${result.aiModel ?? "AI REVIEW"} + RULE ENGINE`
              : "RULE ENGINE REVIEW"}
          </div>
        </section>

        {requirements && (
          <section className="panel">
            <div className="section-kicker">REVIEW BASIS</div>
            <p className="report-item">
              The score is based on the stated application requirements and the architecture
              graph. Capabilities are not penalized when they are not justified by the workload.
            </p>
            <div className="score-row">
              <div><strong>Durable state</strong><small>Whether persistent application state appears required.</small></div>
              <b>{requirements.persistenceRequired ? "REQUIRED" : "NOT ASSUMED"}</b>
            </div>
            <div className="score-row">
              <div><strong>Scale</strong><small>Whether the requirements imply high traffic or rapid growth.</small></div>
              <b>{requirements.highScale ? "HIGH" : "NORMAL"}</b>
            </div>
            <div className="score-row">
              <div><strong>Availability</strong><small>Whether an explicit availability requirement was detected.</small></div>
              <b>{requirements.highAvailability ? "HIGH" : "NORMAL"}</b>
            </div>
            <div className="score-row">
              <div><strong>Async work</strong><small>Whether the workload suggests background or bursty processing.</small></div>
              <b>{requirements.asynchronousWorkLikely ? "LIKELY" : "NOT ASSUMED"}</b>
            </div>
          </section>
        )}

        <section className="panel">
          <div className="section-kicker">SCORE BREAKDOWN</div>
          {result.scores.map((score) => (
            <div className="score-row" key={score.category}>
              <div>
                <strong>{score.category}</strong>
                <small>{score.summary}</small>
              </div>
              <b>{score.score}/{score.maxScore}</b>
            </div>
          ))}
        </section>

        <section className="panel">
          <div className="section-kicker">STRENGTHS</div>
          {result.strengths.map((strength) => (
            <p className="report-item" key={strength}>
              <CheckCircle2 size={14} />
              {strength}
            </p>
          ))}
        </section>

        <section className="panel">
          <div className="section-kicker">FINDINGS</div>
          {result.findings.length ? (
            result.findings.map((finding) => (
              <article className="finding" key={finding.id}>
                <div className="finding-head">
                  <strong>{finding.title}</strong>
                  <span className={`severity severity-${finding.severity}`}>
                    {finding.severity}
                    {finding.source ? ` · ${finding.source.toUpperCase()}` : ""}
                  </span>
                </div>
                <p>{finding.description}</p>
                <small>Evidence: {finding.evidence.join(", ")}</small>
                <p>
                  <b>Recommendation:</b> {finding.recommendation}
                </p>
              </article>
            ))
          ) : (
            <p className="report-item">
              <CheckCircle2 size={14} /> No high-confidence findings were identified.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
