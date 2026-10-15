export type EdgeGateReason = "redirect" | "challenge" | "status-401" | "status-403";

/** Health has no application auth; other APIs retain the meaning of backend JSON 401/403. */
export function detectEdgeGate(response: Response, { anyAuthStatus = false } = {}): EdgeGateReason | null {
  if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) return "redirect";
  if (response.headers.get("cf-mitigated") === "challenge") return "challenge";
  if (response.status === 401 || response.status === 403) {
    const contentType = (response.headers.get("Content-Type") ?? "").split(";", 1)[0].trim().toLowerCase();
    const isJson = contentType === "application/json" || /^application\/[^\s;]+\+json$/.test(contentType);
    if (anyAuthStatus || !isJson) return response.status === 401 ? "status-401" : "status-403";
  }
  return null;
}

export class EdgeGateError extends Error {
  constructor(public readonly reason: EdgeGateReason) {
    super(`Access requires reconnecting: ${reason}`);
    this.name = "EdgeGateError";
  }
}
