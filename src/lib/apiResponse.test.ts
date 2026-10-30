import { describe, expect, it } from "vitest";
import { readApiResponse } from "./apiResponse";

describe("readApiResponse", () => {
  it("parses a successful JSON object", async () => {
    const response = new Response(JSON.stringify({ architectureName: "Ticket booking" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

    await expect(readApiResponse(response)).resolves.toEqual({
      architectureName: "Ticket booking",
    });
  });

  it("converts a plain-text server error into a useful HTTP error", async () => {
    const response = new Response('A server error occurred', {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });

    await expect(readApiResponse(response)).rejects.toThrow(
      "The architecture service returned an unexpected response (HTTP 500).",
    );
  });

  it("handles an HTML error page without exposing markup", async () => {
    const response = new Response("<html><body>Internal Server Error</body></html>", {
      status: 502,
      headers: { "Content-Type": "text/html" },
    });

    await expect(readApiResponse(response)).rejects.toThrow(
      "The architecture service returned an unexpected response (HTTP 502).",
    );
  });

  it("rejects malformed JSON even when the HTTP status is successful", async () => {
    const response = new Response("{not-json", { status: 200 });

    await expect(readApiResponse(response)).rejects.toThrow(
      "The architecture service returned an invalid response.",
    );
  });

  it("rejects valid JSON that is not an object", async () => {
    const response = new Response("[]", { status: 200 });

    await expect(readApiResponse(response)).rejects.toThrow(
      "The architecture service returned an invalid response.",
    );
  });
});
