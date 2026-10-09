import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { generateToken, getApiKeyHint, hashToken } from "./tokens.js";

describe("token helpers", () => {
  it("hashes with SHA-256 as lower-case hex", () => {
    const token = "11111111-2222-4333-8444-555555555555";

    assert.equal(hashToken(token), createHash("sha256").update(token).digest("hex"));
    assert.match(hashToken(token), /^[0-9a-f]{64}$/);
  });

  it("hashes the canonical lower-case form, like the uuid columns compared case-insensitively before", () => {
    assert.equal(
      hashToken("AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE"),
      hashToken("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee")
    );
    assert.equal(hashToken(" aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee "), hashToken("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"));
  });

  it("generates distinct uuid tokens", () => {
    const first = generateToken();
    const second = generateToken();

    assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.notEqual(first, second);
  });

  it("derives the key hint from the last four characters", () => {
    assert.equal(getApiKeyHint("11111111-2222-4333-8444-555555559abc"), "9abc");
  });
});
