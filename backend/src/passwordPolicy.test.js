import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH, validatePassword } from "./passwordPolicy.js";

describe("password policy", () => {
  it("accepts passwords from 8 characters up to 72 bytes", () => {
    assert.equal(validatePassword("12345678"), null);
    assert.equal(validatePassword("a".repeat(72)), null);
  });

  it("rejects passwords shorter than 8 characters", () => {
    assert.match(validatePassword("1234567"), /at least 8 characters/);
    assert.match(validatePassword(""), /at least 8 characters/);
  });

  it("rejects passwords longer than 72 UTF-8 bytes, which bcrypt would silently truncate", () => {
    assert.match(validatePassword("a".repeat(73)), /72 bytes/);
    // 37 two-byte characters are 74 bytes although only 37 characters long.
    assert.match(validatePassword("ä".repeat(37)), /72 bytes/);
    assert.equal(validatePassword("ä".repeat(36)), null);
  });

  it("rejects values that are not strings", () => {
    for (const value of [undefined, null, 12345678, ["password"], { length: 10 }]) {
      assert.match(validatePassword(value), /must be a string/);
    }
  });

  it("exports the limits used by the frontend hint", () => {
    assert.equal(MIN_PASSWORD_LENGTH, 8);
    assert.equal(MAX_PASSWORD_BYTES, 72);
  });
});
