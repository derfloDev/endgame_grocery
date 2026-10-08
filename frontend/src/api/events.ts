import { sendJsonRequest } from "./client";

interface EventTicketResponse {
  ticket?: string;
}

/**
 * Requests a single-use ticket for opening the event stream.
 *
 * `EventSource` cannot send an `Authorization` header, so the stream URL carries this short-lived
 * ticket instead of the JWT, which keeps the session token out of URLs and access logs. A 401
 * dispatches `auth:expired` and throws `AuthExpiredError` like every other authenticated request.
 */
export async function fetchEventTicket(token: string): Promise<string> {
  const data = (await sendJsonRequest("/api/events/ticket", { method: "POST", token })) as EventTicketResponse | null;

  if (!data?.ticket) {
    throw new Error("The server did not return an event stream ticket.");
  }

  return data.ticket;
}
