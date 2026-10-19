import { supabase } from "./supabase";
import {
  evaluateSystemDesign,
  mergeAIReview,
  type EvaluationInput,
  type EvaluationResult,
  type AIReview,
} from "./evaluationEngine";

export async function evaluateSystemDesignWithAI(
  input: EvaluationInput,
): Promise<EvaluationResult> {
  const deterministic = evaluateSystemDesign(input);

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return deterministic;
    const response = await fetch("/api/evaluate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        application: input.application,
        nodes: input.nodes.map((node) => ({
          id: node.id,
          typeKey: node.data?.typeKey ?? "",
          label: node.data?.label ?? node.id,
          category: node.data?.category ?? "",
          notes: node.data?.notes ?? "",
        })),
        edges: input.edges,
        notes: input.notes ?? "",
        workload: input.workload,
        graphAnalysis: deterministic.graphAnalysis,
      }),
    });

    if (!response.ok) {
      throw new Error("AI evaluation service unavailable.");
    }

    const review = (await response.json()) as AIReview & { model?: string };

    if (!Array.isArray(review.findings) || !Array.isArray(review.topicReviews)) {
      throw new Error("AI evaluation returned an invalid review.");
    }

    return mergeAIReview(
      deterministic,
      review,
      review.model ?? "openrouter/free",
      input,
    );
  } catch {
    return deterministic;
  }
}
