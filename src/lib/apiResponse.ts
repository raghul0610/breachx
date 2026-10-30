/**
 * Read a server response exactly once and require a JSON object.
 *
 * Serverless platforms can return plain-text or HTML error pages before an API
 * handler runs. Treat those as transport failures instead of leaking a JSON
 * SyntaxError such as "Unexpected token 'A'".
 */
export type ApiResponsePayload = {
  error?: unknown;
  validation?: { passed?: boolean; errors?: unknown[]; warnings?: unknown[] };
  evaluation?: {
    passed?: boolean;
    score?: number;
    summary?: string;
    findings?: Array<{ severity: string; title: string; recommendation: string }>;
  };
  [key: string]: unknown;
};

export async function readApiResponse(response: Response): Promise<ApiResponsePayload> {
  let raw: string;

  try {
    raw = await response.text();
  } catch {
    throw new Error("The architecture service response could not be read. Please try again.");
  }

  let payload: unknown;
  try {
    payload = raw.length > 0 ? JSON.parse(raw) : {};
  } catch {
    if (!response.ok) {
      throw new Error(
        `The architecture service returned an unexpected response (HTTP ${response.status}). Check the deployment logs if this continues.`,
      );
    }

    throw new Error("The architecture service returned an invalid response. Please try again.");
  }

  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("The architecture service returned an invalid response. Please try again.");
  }

  return payload as ApiResponsePayload;
}
