import { randomBytes } from "node:crypto";

const TICKET_TTL_MS = 30_000;

/**
 * Creates an in-memory store of single-use tickets for opening the SSE stream.
 *
 * `EventSource` cannot send an `Authorization` header, so the browser used to put its JWT in the
 * query string, where it ended up in access logs and browser history. Instead the client asks for
 * a short-lived, single-use ticket over an authenticated request and puts only that into the URL.
 * Tickets live in memory, which matches the single-instance deployment (see README).
 *
 * @param {object} [options] Store options.
 * @param {() => number} [options.now] Clock in milliseconds, injectable for tests.
 * @param {number} [options.ttlMs] Ticket lifetime in milliseconds.
 * @returns {{
 *   issue: (userId: string) => string,
 *   consume: (ticket: unknown) => string | null,
 *   size: () => number
 * }} Ticket store.
 */
export function createSseTickets({ now = Date.now, ttlMs = TICKET_TTL_MS } = {}) {
  const tickets = new Map();

  function sweep() {
    const currentTime = now();

    for (const [ticket, entry] of tickets) {
      if (entry.expiresAt <= currentTime) {
        tickets.delete(ticket);
      }
    }
  }

  return {
    /** Issues a ticket for a user and drops expired ones. */
    issue(userId) {
      sweep();
      const ticket = randomBytes(32).toString("base64url");
      tickets.set(ticket, { userId, expiresAt: now() + ttlMs });
      return ticket;
    },

    /** Returns the user id for a valid ticket and invalidates it; null otherwise. */
    consume(ticket) {
      if (typeof ticket !== "string") {
        return null;
      }

      const entry = tickets.get(ticket);
      tickets.delete(ticket);

      if (!entry || entry.expiresAt <= now()) {
        return null;
      }

      return entry.userId;
    },

    size() {
      return tickets.size;
    }
  };
}

export const sseTickets = createSseTickets();
