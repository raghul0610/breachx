import { useState, type FormEvent } from "react";
import { Bot, Check, LoaderCircle, MessageSquare, Send, Sparkles, WandSparkles } from "lucide-react";
import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type { BlueprintNodeData } from "./BlueprintNode";

type GeneratedArchitecture = {
  architectureName: string;
  overview: string;
  requestFlow: string;
  designDecisions: string[];
  assumptions?: string[];
  requirementCoverage?: { requirement: string; componentIds: string[]; rationale: string }[];
  validation?: { passed: boolean; errors: string[]; warnings: string[] };
  components: { id: string; typeKey: string; label: string; category: string; notes: string }[];
  connections: { source: string; target: string; label: string; communicationType?: string; purpose?: string }[];
};
type ChatMessage = { role: "user" | "assistant"; content: string };
type Mode = "planning" | "agent";

export function ArchitectureAIChat({
  name,
  requirements,
  nodes,
  edges,
  onApply,
  onBeforeApply,
}: {
  name: string;
  requirements: string;
  nodes: Node<BlueprintNodeData>[];
  edges: Edge[];
  onApply: (name: string, nodes: Node<BlueprintNodeData>[], edges: Edge[], summary: string) => void;
  onBeforeApply: () => void;
}) {
  const [mode, setMode] = useState<Mode>("planning");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "I can help create, inspect, update, connect, or remove architecture components. Planning previews a proposed graph; Agent applies the generated graph to your canvas." },
  ]);
  const [pending, setPending] = useState<{ result: GeneratedArchitecture; nodes: Node<BlueprintNodeData>[]; edges: Edge[]; request: string } | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const instruction = input.trim();
    if (!instruction || loading) return;
    setInput("");
    setError("");
    setPending(null);
    setMessages((current) => [...current, { role: "user", content: instruction }]);
    setLoading(true);
    try {
      const response = await fetch("/api/generate-architecture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          requirements: requirements.trim().length >= 20 ? requirements : `Architecture project: ${name}. User requirements: ${requirements || "Not provided yet."}. Preserve the current design unless the user explicitly requests a change.`,
          instruction,
          currentArchitecture: {
            components: nodes.map((node) => ({
              id: node.id,
              typeKey: node.data.typeKey,
              label: node.data.label,
              category: node.data.category,
              notes: node.data.notes ?? "",
              position: node.position,
            })),
            connections: edges.map((edge) => ({
              id: edge.id,
              source: edge.source,
              target: edge.target,
              label: typeof edge.label === "string" ? edge.label : "",
            })),
          },
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "The architecture assistant could not complete that request.");
      const result = payload as GeneratedArchitecture;
      const oldById = new Map(nodes.map((node) => [node.id, node]));
      const oldByLabel = new Map(nodes.map((node) => [node.data.label.toLowerCase(), node]));
      const nextNodes: Node<BlueprintNodeData>[] = result.components.map((component, index) => {
        const existing = oldById.get(component.id) ?? oldByLabel.get(component.label.toLowerCase());
        return {
          id: component.id,
          type: "blueprintNode",
          position: existing?.position ?? { x: 80 + (index % 4) * 250, y: 80 + Math.floor(index / 4) * 170 },
          data: { label: component.label, typeKey: component.typeKey, category: component.category, notes: component.notes || undefined },
        };
      });
      const validIds = new Set(nextNodes.map((node) => node.id));
      const nextEdges: Edge[] = result.connections
        .filter((connection) => validIds.has(connection.source) && validIds.has(connection.target) && connection.source !== connection.target)
        .map((connection, index) => ({
          id: `ai-edge-${index}-${connection.source}-${connection.target}`,
          source: connection.source,
          target: connection.target,
          label: [connection.label, connection.communicationType, connection.purpose].filter(Boolean).join(" · ") || undefined,
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed },
        }));
      if (nextNodes.length < 3 || nextEdges.length < 2) throw new Error("The proposed architecture is incomplete. No changes were applied.");
      const plan = { result, nodes: nextNodes, edges: nextEdges, request: instruction };
      setPending(plan);
      const validationSummary = result.validation?.warnings?.length ? ` Validation warnings: ${result.validation.warnings.slice(0, 3).join(" ")}` : "";\n      const summary = `Proposed ${nextNodes.length} components and ${nextEdges.length} connections. ${result.overview}${validationSummary}`;
      setMessages((current) => [...current, { role: "assistant", content: mode === "agent" ? `Applied your request: ${summary}` : `Plan ready. ${summary} Review it, then apply the proposal to the canvas.` }]);
      if (mode === "agent") {
        onBeforeApply();
        onApply(result.architectureName || name, nextNodes, nextEdges, result.overview);
        setPending(null);
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "The architecture assistant could not complete that request.";
      setError(message);
      setMessages((current) => [...current, { role: "assistant", content: `I couldn't apply that request: ${message}` }]);
    } finally {
      setLoading(false);
    }
  }

  function applyPlan() {
    if (!pending) return;
    onBeforeApply();
    onApply(pending.result.architectureName || name, pending.nodes, pending.edges, pending.result.overview);
    setMessages((current) => [...current, { role: "assistant", content: "Plan applied to the canvas. Review the resulting nodes and connections before saving." }]);
    setPending(null);
  }

  return (
    <section className="architecture-ai-chat" aria-label="AI architecture assistant" data-tutorial="architecture-ai-chat">
      <div className="ai-chat-heading">
        <div className="ai-chat-title-icon"><Bot size={16} /></div>
        <div className="ai-chat-title"><strong>ARCHITECTURE AI</strong><span>CRUD assistant · OpenRouter</span></div>
        <span className="ai-chat-live-dot" title="Assistant available" />
      </div>
      <div className="ai-chat-mode" role="group" aria-label="AI operating mode">
        <button type="button" className={mode === "planning" ? "active" : ""} onClick={() => { setMode("planning"); setPending(null); }} aria-pressed={mode === "planning"}><Sparkles size={12} /> PLANNING</button>
        <button type="button" className={mode === "agent" ? "active" : ""} onClick={() => { setMode("agent"); setPending(null); }} aria-pressed={mode === "agent"}><WandSparkles size={12} /> AGENT</button>
      </div>
      <div className="ai-chat-mode-hint">{mode === "planning" ? "Propose changes first. You decide when to apply them." : "Generate and apply changes directly to the canvas."}</div>
      <div className="ai-chat-messages" aria-live="polite">
        {messages.map((message, index) => (
          <article key={index} className={`ai-chat-message ai-chat-message-${message.role}`}>
            <span className="ai-chat-message-role">{message.role === "user" ? "YOU" : "ANCHON AI"}</span>
            <p>{message.content}</p>
          </article>
        ))}
        {loading && <div className="ai-chat-loading"><LoaderCircle size={14} className="ai-chat-spinner" /> Thinking through the architecture…</div>}
      </div>
      {error && <p className="ai-chat-error" role="alert">{error}</p>}
      {pending && mode === "planning" && (
        <div className="ai-chat-plan">
          <div><strong>PROPOSED CHANGESET</strong><span>{pending.nodes.length} components · {pending.edges.length} connections</span></div>
          <p>{pending.result.designDecisions.slice(0, 2).join(" ") || pending.result.overview}</p>
          <button type="button" className="ai-chat-apply" onClick={applyPlan}><Check size={13} /> APPLY TO CANVAS</button>
        </div>
      )}
      <form className="ai-chat-composer" onSubmit={submit}>
        <label className="sr-only" htmlFor="architecture-ai-prompt">Describe an architecture change</label>
        <textarea id="architecture-ai-prompt" value={input} onChange={(event) => setInput(event.target.value)} rows={3} placeholder="Add Redis caching, rename the API Gateway, remove the queue…" disabled={loading} />
        <div className="ai-chat-composer-footer"><span><MessageSquare size={11} /> Uses your current graph as context</span><button type="submit" disabled={loading || !input.trim()} aria-label="Send message">{loading ? <LoaderCircle size={14} className="ai-chat-spinner" /> : <Send size={14} />} SEND</button></div>
      </form>
    </section>
  );
}
