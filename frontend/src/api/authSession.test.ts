import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getAuthToken,
  getCurrentUserId,
  getTokenSubject,
  notifyAuthSession,
  publishAuthSession,
  resetAuthSessionForTests,
  setAuthSession,
  subscribeAuthSession
} from "./authSession";

function jwtFor(sub: string): string {
  const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${encode({ alg: "HS256" })}.${encode({ sub })}.signature`;
}

describe("auth session", () => {
  afterEach(() => resetAuthSessionForTests());

  it("starts signed out", () => {
    expect(getAuthToken()).toBe("");
    expect(getCurrentUserId()).toBe("");
  });

  it("exposes the current token and user", () => {
    setAuthSession("jwt-1", "user-1");

    expect(getAuthToken()).toBe("jwt-1");
    expect(getCurrentUserId()).toBe("user-1");
  });

  it("notifies subscribers only when the session actually changes", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAuthSession(listener);

    setAuthSession("jwt-1", "user-1");
    setAuthSession("jwt-1", "user-1");
    setAuthSession("jwt-2", "user-1");
    setAuthSession("", "");
    unsubscribe();
    setAuthSession("jwt-3", "user-3");

    expect(listener).toHaveBeenCalledTimes(3);
    expect(listener).toHaveBeenNthCalledWith(1, { token: "jwt-1", userId: "user-1" });
    expect(listener).toHaveBeenNthCalledWith(3, { token: "", userId: "" });
  });

  it("can publish silently while rendering and notify afterwards", () => {
    const listener = vi.fn();
    subscribeAuthSession(listener);

    publishAuthSession("jwt-1", "user-1");

    expect(getCurrentUserId()).toBe("user-1");
    expect(listener).not.toHaveBeenCalled();

    notifyAuthSession();
    notifyAuthSession();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ token: "jwt-1", userId: "user-1" });
  });

  it("reads the subject of a JWT and tolerates garbage", () => {
    expect(getTokenSubject(jwtFor("user-9"))).toBe("user-9");
    expect(getTokenSubject("not-a-jwt")).toBe("");
    expect(getTokenSubject("")).toBe("");
    expect(getTokenSubject("a.%%%.c")).toBe("");
  });
});
