/**
 * The signed-in session as plain module state.
 *
 * The offline cache and queue are not React code, yet they must follow the signed-in user: they
 * scope everything by user id and the queue drain sends the *current* token. `AuthProvider` keeps
 * this in sync; everything else only reads it.
 */
export interface AuthSession {
  token: string;
  userId: string;
}

type Listener = (session: AuthSession) => void;

let session: AuthSession = { token: "", userId: "" };
const listeners = new Set<Listener>();

export function getAuthToken(): string {
  return session.token;
}

export function getCurrentUserId(): string {
  return session.userId;
}

let notifiedSession: AuthSession = session;

/**
 * Updates the session without telling subscribers. `AuthProvider` calls this while rendering, so
 * that the children's first effects read the right user; subscribers set React state, which must
 * not happen during another component's render. Follow up with {@link notifyAuthSession}.
 */
export function publishAuthSession(token: string, userId: string): void {
  if (session.token !== token || session.userId !== userId) {
    session = { token, userId };
  }
}

/** Tells subscribers about the session if it changed since they were last informed. */
export function notifyAuthSession(): void {
  if (notifiedSession.token === session.token && notifiedSession.userId === session.userId) {
    return;
  }

  notifiedSession = session;

  for (const listener of listeners) {
    listener(session);
  }
}

/** Updates the session and notifies subscribers when token or user changed. */
export function setAuthSession(token: string, userId: string): void {
  publishAuthSession(token, userId);
  notifyAuthSession();
}

export function subscribeAuthSession(listener: Listener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/** Returns the `sub` claim of a JWT, or an empty string when the token is not a readable JWT. */
export function getTokenSubject(token: string): string {
  try {
    const payload = token.split(".")[1];

    if (!payload) {
      return "";
    }

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4 || 4)) % 4), "=");
    const decoded = JSON.parse(atob(padded)) as { sub?: unknown } | null;

    return typeof decoded?.sub === "string" ? decoded.sub : "";
  } catch {
    return "";
  }
}

export function resetAuthSessionForTests(): void {
  session = { token: "", userId: "" };
  notifiedSession = session;
  listeners.clear();
}
