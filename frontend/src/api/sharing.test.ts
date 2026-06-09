import { afterEach, describe, expect, it, vi } from "vitest";
import { leaveList } from "./sharing";

describe("leaveList", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("deletes the authenticated user's list membership", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204
    });
    vi.stubGlobal("fetch", fetchMock);

    await leaveList("list-1", "test-token");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/lists/list-1/leave",
      expect.objectContaining({
        method: "DELETE",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token"
        })
      })
    );
  });
});
